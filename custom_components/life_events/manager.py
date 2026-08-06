"""Runtime manager: owns the event list, storage, entities and services."""
from __future__ import annotations

import logging
from datetime import date, timedelta

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_call_later
from homeassistant.util import dt as dt_util

from .const import (
    CONF_ATTRIBUTES,
    CONF_DATE,
    CONF_DATE_OF_DEATH,
    CONF_EVENT_TYPE,
    CONF_FIXED_ATTR_KEY,
    CONF_ICON,
    CONF_NAME,
    EVENT_TYPE_ANNIVERSARY,
    EVENT_TYPE_DECEASED,
    LEGACY_ANNIVERSARY_HINTS,
    RELATIONSHIP_TYPE_MARRIED,
    SIGNAL_EVENTS_UPDATED,
)
from .entity import EventEntity
from .fixed_attributes import FixedAttributesStore
from .models import Event, new_event_id
from .store import LifeEventsStore, export_events, parse_events

_LOGGER = logging.getLogger(__name__)


class LifeEventsManager:
    """Owns the list of events for one config entry and keeps entities in sync."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self.store = LifeEventsStore(hass, entry_id)
        self.fixed_attributes_store = FixedAttributesStore(hass, entry_id)
        self.events: dict[str, Event] = {}
        self.fixed_attributes: list[dict] = []
        # Set by the life_events platform's async_setup_entry (see
        # life_events.py) once HA hands us a config-entry-scoped
        # async_add_entities callback - only then can entities actually be
        # created, so async_setup() below just loads the data.
        self._async_add_entities: AddEntitiesCallback | None = None
        self._entities: dict[str, EventEntity] = {}
        self._unsub_midnight = None

    @property
    def signal(self) -> str:
        return f"{SIGNAL_EVENTS_UPDATED}_{self.entry_id}"

    async def async_setup(self, legacy_yaml_birthdays: list[dict] | None) -> None:
        """Load event data from storage/legacy YAML. Does not create entities yet."""
        events = await self.store.async_load()

        if not events and legacy_yaml_birthdays:
            _LOGGER.info(
                "No stored events yet, importing %d entries from configuration.yaml",
                len(legacy_yaml_birthdays),
            )
            events = _events_from_legacy_yaml(legacy_yaml_birthdays)
            await self.store.async_save(events)

        self.events = {e.id: e for e in events}
        self.fixed_attributes = await self.fixed_attributes_store.async_load()

    async def async_setup_entities(self, async_add_entities: AddEntitiesCallback) -> None:
        """Called by the life_events platform once it has a real, config-entry-bound callback."""
        self._async_add_entities = async_add_entities
        self._entities = {event_id: EventEntity(self, event_id) for event_id in self.events}
        async_add_entities(list(self._entities.values()))
        self._recompute_states()
        self._schedule_midnight_update()

    async def async_unload(self) -> None:
        # Entities themselves are torn down by HA's own platform unload
        # (see async_unload_entry in __init__.py, which unloads the
        # life_events platform before calling this) - only the timer needs
        # explicit cleanup here.
        if self._unsub_midnight:
            self._unsub_midnight()

    def _schedule_midnight_update(self) -> None:
        def _seconds_until_midnight() -> float:
            now = dt_util.now()
            seconds_passed = now.hour * 3600 + now.minute * 60 + now.second
            return 24 * 3600 - seconds_passed

        async def _midnight(_now) -> None:
            self._recompute_states()
            self._fire_today_events()
            self._unsub_midnight = async_call_later(self.hass, _seconds_until_midnight(), _midnight)

        self._unsub_midnight = async_call_later(self.hass, _seconds_until_midnight(), _midnight)

    def _recompute_states(self) -> None:
        for entity in self._entities.values():
            entity.async_write_ha_state()

    def _fire_today_events(self) -> None:
        today = dt_util.start_of_local_day().date()
        for event in self.events.values():
            if event.days_until_next_occurrence(today) == 0:
                self.hass.bus.async_fire(
                    "birthday",
                    {
                        "name": event.name,
                        "age": event.years_at_next_occurrence(today),
                        "event_type": event.event_type,
                        "deceased": event.event_type == "deceased",
                    },
                )

    # -- Fixed attributes -------------------------------------------------

    async def async_set_fixed_attributes(self, fixed_attributes: list[dict]) -> None:
        self.fixed_attributes = fixed_attributes
        await self.fixed_attributes_store.async_save(fixed_attributes)
        async_dispatcher_send(self.hass, self.signal)

    def _check_required_attributes(self, attributes: dict) -> None:
        """Every configured fixed attribute must be present and non-blank.

        Defense in depth: the cards already validate this client-side before
        calling add_event/update_event, but a direct service call or
        automation could otherwise silently create/update an event missing
        a field the user explicitly marked as required.
        """
        missing = [
            fa[CONF_FIXED_ATTR_KEY]
            for fa in self.fixed_attributes
            if not str(attributes.get(fa[CONF_FIXED_ATTR_KEY], "") or "").strip()
        ]
        if missing:
            raise ServiceValidationError(f"Missing required attribute(s): {', '.join(missing)}")

    def _purge_entity(self, entity: EventEntity) -> None:
        """Fully remove an entity - registry entry AND state, not just mark it unavailable.

        `Entity.async_remove(force_remove=True)` (the old approach here)
        only ever removes the entity's *state* - the entity *registry*
        entry (what Settings -> Entities keeps showing as "This entity is
        no longer available from the life_events integration... can be
        removed from Settings") is a completely separate record that call
        never touches. Removing the registry entry directly is both
        necessary and sufficient: HA's own entity_registry-updated listener
        (subscribed by every Entity while added) reacts to the "remove"
        event by clearing its state too, so there is nothing further to
        call here.
        """
        er.async_get(self.hass).async_remove(entity.entity_id)

    def _validate_parent_ids(self, event_id: str, parent_ids: list[str]) -> None:
        """Enforce the max-2, no-self/duplicate/unknown-id, direct-cycle rules.

        Deliberately only a direct-cycle guard (can't set your own child as
        your own parent) - full multi-generation ancestry checking is out
        of scope, this just prevents the one obviously-wrong case.
        """
        if len(parent_ids) > 2:
            raise ServiceValidationError("A person can have at most 2 linked parents")
        if len(set(parent_ids)) != len(parent_ids):
            raise ServiceValidationError("Duplicate parent id")
        if event_id in parent_ids:
            raise ServiceValidationError("A person cannot be their own parent")
        for parent_id in parent_ids:
            if parent_id not in self.events:
                raise ServiceValidationError(f"Unknown parent event id: {parent_id}")
            if event_id in self.events[parent_id].parent_ids:
                raise ServiceValidationError("Cannot set your own child as your parent")

    # -- CRUD -----------------------------------------------------------------

    def _refresh_parents(self, parent_ids: set[str]) -> None:
        """Push a state update to each given parent's entity.

        children_ids/children_names (see entity.py) is computed on read
        from the CHILD's own parent_ids, not stored on the parent - so
        without this, a parent's entity would keep showing its
        last-computed children list until something unrelated happened to
        refresh it (e.g. the midnight recompute), rather than reflecting a
        just-added/removed link immediately.
        """
        for parent_id in parent_ids:
            parent_entity = self._entities.get(parent_id)
            if parent_entity:
                parent_entity.async_write_ha_state()

    async def async_add_event(self, **fields) -> Event:
        self._check_required_attributes(fields.get("attributes") or {})
        event = Event.create(**fields)
        self._validate_parent_ids(event.id, event.parent_ids)
        self.events[event.id] = event
        await self.store.async_save(list(self.events.values()))
        new_entity = EventEntity(self, event.id)
        self._entities[event.id] = new_entity
        self._async_add_entities([new_entity])
        self._refresh_parents(set(event.parent_ids))
        async_dispatcher_send(self.hass, self.signal)
        return event

    async def async_update_event(self, event_id: str, **fields) -> Event:
        if event_id not in self.events:
            raise KeyError(f"Unknown event id: {event_id}")
        current = self.events[event_id]
        merged = {
            "name": fields.get("name", current.name),
            "date_": fields.get("date_", current.date),
            "event_type": fields.get("event_type", current.event_type),
            "event_id": event_id,
            "date_of_death": fields.get("date_of_death", current.date_of_death),
            "icon": fields.get("icon", current.icon),
            "phone_number": fields.get("phone_number", current.phone_number),
            "time": fields.get("time", current.time),
            # Never caller-settable (deliberately excluded from
            # UPDATE_EVENT_SCHEMA - see the Event.spouse_id/marriage_date
            # comment in models.py), so always preserved from `current`
            # rather than read from `fields` - an update to an unrelated
            # field (e.g. marking someone deceased) must not silently wipe
            # an existing marriage link.
            "spouse_id": current.spouse_id,
            "marriage_date": current.marriage_date,
            "relationship_type": current.relationship_type,
            "parent_ids": fields.get("parent_ids", current.parent_ids),
            "partner_ids": current.partner_ids,
            "attributes": fields.get("attributes", current.attributes),
        }
        self._check_required_attributes(merged["attributes"])
        self._validate_parent_ids(event_id, merged["parent_ids"])
        changed_parent_ids = set(current.parent_ids) ^ set(merged["parent_ids"])
        updated = Event.create(**merged)
        self.events[event_id] = updated
        await self.store.async_save(list(self.events.values()))
        entity = self._entities.get(event_id)
        if entity:
            entity.async_write_ha_state()
        self._refresh_parents(changed_parent_ids)
        async_dispatcher_send(self.hass, self.signal)
        return updated

    async def async_delete_event(self, event_id: str) -> None:
        if event_id not in self.events:
            return
        deleted_event = self.events[event_id]

        # If this IS an auto-created couple's-anniversary entity (always
        # has exactly 2 partner_ids), deleting it directly must
        # symmetrically unlink both partners too - reuses only the
        # field-clearing half (_unlink_pair_fields), not
        # async_unlink_marriage, so it doesn't loop back into deleting
        # this same entity again mid-deletion.
        if len(deleted_event.partner_ids) == 2:
            self._unlink_pair_fields(deleted_event.partner_ids[0], deleted_event.partner_ids[1])

        # A surviving spouse's own record must not keep pointing at a
        # spouse_id that no longer exists - clear their side of the link
        # too (their own marriage_date/spouse_id, not the deleted record,
        # which is gone regardless). The couple's anniversary entity, if
        # any, can't outlive either partner either.
        spouse_id = deleted_event.spouse_id
        if spouse_id and spouse_id in self.events:
            spouse = self.events[spouse_id]
            spouse.spouse_id = None
            spouse.marriage_date = None
            spouse.relationship_type = RELATIONSHIP_TYPE_MARRIED
            spouse_entity = self._entities.get(spouse_id)
            if spouse_entity:
                spouse_entity.async_write_ha_state()
        if spouse_id:
            self._delete_anniversary_entity_for_pair(event_id, spouse_id)
        # No reverse index from parent -> children (deliberate, see
        # CONF_PARENT_IDS in const.py), so freeing a deleted parent from
        # every child that referenced it means scanning all events.
        for child in self.events.values():
            if child.id != event_id and event_id in child.parent_ids:
                child.parent_ids = [pid for pid in child.parent_ids if pid != event_id]
                child_entity = self._entities.get(child.id)
                if child_entity:
                    child_entity.async_write_ha_state()
        # Symmetrically, deleting a CHILD must refresh its former parents'
        # entities too, so their children_ids/children_names drops it
        # immediately rather than waiting on an unrelated refresh.
        former_parent_ids = set(self.events[event_id].parent_ids)
        del self.events[event_id]
        await self.store.async_save(list(self.events.values()))
        entity = self._entities.pop(event_id, None)
        if entity:
            self._purge_entity(entity)
        self._refresh_parents(former_parent_ids)
        async_dispatcher_send(self.hass, self.signal)

    # -- Marriage linking --------------------------------------------------

    def _clear_stale_marriage_link(self, event_id: str) -> str | None:
        """If event_id is currently linked, clear that link before relinking.

        The OTHER side is only cleared too if that spouse is still alive -
        a living "divorce" is symmetric, but if event_id's old spouse has
        since died, their own record is left untouched (their marriage
        history stays factually intact; only event_id itself moves on to
        the new marriage) - see the "widow(er) remarries" case in the
        roadmap this implements. Returns the freed spouse's id (if any),
        so the caller can push a state update to that entity too - its
        Event object is mutated here, but nothing re-reads it otherwise.
        """
        event = self.events.get(event_id)
        if not event or not event.spouse_id:
            return None
        old_spouse_id = event.spouse_id
        old_spouse = self.events.get(old_spouse_id)
        freed_id = None
        if old_spouse and old_spouse.event_type != EVENT_TYPE_DECEASED:
            old_spouse.spouse_id = None
            old_spouse.marriage_date = None
            old_spouse.relationship_type = RELATIONSHIP_TYPE_MARRIED
            freed_id = old_spouse_id
        event.spouse_id = None
        event.marriage_date = None
        event.relationship_type = RELATIONSHIP_TYPE_MARRIED
        return freed_id

    def _unlink_pair_fields(self, id_a: str | None, id_b: str | None) -> None:
        """Clear spouse_id/marriage_date/relationship_type on both sides.

        No anniversary-entity side effects, deliberately - kept separate
        from async_unlink_marriage so async_delete_event can reuse just
        this field-clearing half when the anniversary entity itself is
        what's being deleted, without looping back into deleting that same
        entity again.
        """
        for eid in (id_a, id_b):
            if not eid:
                continue
            person = self.events.get(eid)
            if not person:
                continue
            person.spouse_id = None
            person.marriage_date = None
            person.relationship_type = RELATIONSHIP_TYPE_MARRIED
            entity = self._entities.get(eid)
            if entity:
                entity.async_write_ha_state()

    def _anniversary_pair_id(self, id_a: str, id_b: str) -> str:
        """Deterministic id for a couple's auto-created anniversary Event.

        Derived purely from the sorted pair of partner ids (never stored
        separately), so re-linking the same pair - e.g. filling in a
        previously-unknown date, or changing relationship_type - always
        resolves to the same entity instead of creating a duplicate.
        """
        sorted_ids = sorted([id_a, id_b])
        return new_event_id(f"{sorted_ids[0]}_{sorted_ids[1]}_anniversary")

    def _upsert_anniversary_entity(
        self, id_a: str, id_b: str, marriage_date: date | None, relationship_type: str
    ) -> None:
        """Create or update the real entity for a couple's anniversary.

        No-op while marriage_date is unknown - consistent with "no
        anniversary occasion until it's filled in" elsewhere. Bypasses
        _check_required_attributes on purpose: this isn't a person, so it
        must never be blocked by a required fixed attribute like "geslacht".
        """
        if marriage_date is None:
            return
        sorted_ids = sorted([id_a, id_b])
        first = self.events.get(sorted_ids[0])
        second = self.events.get(sorted_ids[1])
        if not first or not second:
            return
        pair_id = self._anniversary_pair_id(id_a, id_b)
        anniversary = Event.create(
            name=f"{first.name} & {second.name}",
            date_=marriage_date,
            event_type=EVENT_TYPE_ANNIVERSARY,
            event_id=pair_id,
            relationship_type=relationship_type,
            partner_ids=[id_a, id_b],
        )
        is_new = anniversary.id not in self.events
        self.events[anniversary.id] = anniversary
        if is_new:
            new_entity = EventEntity(self, anniversary.id)
            self._entities[anniversary.id] = new_entity
            self._async_add_entities([new_entity])
        else:
            entity = self._entities.get(anniversary.id)
            if entity:
                entity.async_write_ha_state()

    def _delete_anniversary_entity_for_pair(self, id_a: str, id_b: str) -> None:
        """Delete the anniversary entity for this pair, if one exists.

        No side effects on the partner records themselves - callers handle
        their own field-clearing separately.
        """
        pair_id = self._anniversary_pair_id(id_a, id_b)
        if pair_id not in self.events:
            return
        del self.events[pair_id]
        entity = self._entities.pop(pair_id, None)
        if entity:
            self._purge_entity(entity)

    async def async_link_marriage(
        self, event_id: str, spouse_id: str, marriage_date: date | None, relationship_type: str = RELATIONSHIP_TYPE_MARRIED
    ) -> None:
        """Link two existing persons as spouses/partners, symmetrically.

        marriage_date may be None - the link/anniversary date isn't always
        known up front (e.g. a couple already married before this
        integration existed) - the link is still recorded, just without an
        anniversary occasion until the date is filled in via a re-link
        later (marriage_date isn't editable via plain update_event).
        """
        if event_id not in self.events:
            raise ServiceValidationError(f"Unknown event id: {event_id}")
        if spouse_id not in self.events:
            raise ServiceValidationError(f"Unknown event id: {spouse_id}")
        if event_id == spouse_id:
            raise ServiceValidationError("A person cannot marry themselves")

        # Captured before clearing, so a stale PREVIOUS pairing's
        # anniversary entity can be deleted below even when re-linking the
        # SAME pair (old_a == spouse_id in that case, correctly skipped -
        # _upsert_anniversary_entity finds and updates that same entity
        # in place instead).
        old_a = self.events[event_id].spouse_id
        old_b = self.events[spouse_id].spouse_id

        # Defensive: normally the UI only offers unmarried candidates, but
        # a direct service call could ask to link someone already linked
        # elsewhere - unwind any existing link on either side first so the
        # result is never a 3-way inconsistency.
        freed_a = self._clear_stale_marriage_link(event_id)
        freed_b = self._clear_stale_marriage_link(spouse_id)

        if old_a and old_a != spouse_id:
            self._delete_anniversary_entity_for_pair(event_id, old_a)
        if old_b and old_b != event_id:
            self._delete_anniversary_entity_for_pair(spouse_id, old_b)

        self.events[event_id].spouse_id = spouse_id
        self.events[event_id].marriage_date = marriage_date
        self.events[event_id].relationship_type = relationship_type
        self.events[spouse_id].spouse_id = event_id
        self.events[spouse_id].marriage_date = marriage_date
        self.events[spouse_id].relationship_type = relationship_type

        self._upsert_anniversary_entity(event_id, spouse_id, marriage_date, relationship_type)

        await self.store.async_save(list(self.events.values()))
        affected = {event_id, spouse_id}
        if freed_a:
            affected.add(freed_a)
        if freed_b:
            affected.add(freed_b)
        for eid in affected:
            entity = self._entities.get(eid)
            if entity:
                entity.async_write_ha_state()
        async_dispatcher_send(self.hass, self.signal)

    async def async_unlink_marriage(self, event_id: str) -> None:
        """Divorce/end a relationship: symmetrically clear the link and
        delete the couple's anniversary entity, if one exists."""
        if event_id not in self.events:
            raise ServiceValidationError(f"Unknown event id: {event_id}")
        spouse_id = self.events[event_id].spouse_id
        self._unlink_pair_fields(event_id, spouse_id)
        if spouse_id:
            self._delete_anniversary_entity_for_pair(event_id, spouse_id)

        await self.store.async_save(list(self.events.values()))
        for eid in (event_id, spouse_id):
            entity = self._entities.get(eid) if eid else None
            if entity:
                entity.async_write_ha_state()
        async_dispatcher_send(self.hass, self.signal)

    async def async_import_events(self, content: str, fmt: str, mode: str) -> int:
        new_events = parse_events(content, fmt)

        if mode == "replace":
            for entity in list(self._entities.values()):
                self._purge_entity(entity)
            self._entities = {}
            self.events = {}

        for event in new_events:
            self.events[event.id] = event

        await self.store.async_save(list(self.events.values()))

        to_add = [EventEntity(self, e.id) for e in new_events if e.id not in self._entities]
        for new_entity in to_add:
            self._entities[new_entity.unique_id] = new_entity
        if to_add:
            self._async_add_entities(to_add)

        self._recompute_states()
        async_dispatcher_send(self.hass, self.signal)
        return len(new_events)

    def export_events(self, fmt: str) -> str:
        return export_events(list(self.events.values()), fmt)


def _events_from_legacy_yaml(raw_birthdays: list[dict]) -> list[Event]:
    """Convert the flat `birthdays:` YAML list (from !include_dir_merge_list) into events.

    Every entry historically lived under the same `birthdays:` key regardless of
    whether it represented an actual birthday or a wedding anniversary
    (trouwdagen.yaml). There is no explicit type field in the legacy format, so
    entries are heuristically classified as anniversaries when their name or
    unique_id mentions one of LEGACY_ANNIVERSARY_HINTS; everything else is
    imported as a birthday.
    """
    events = []
    for raw in raw_birthdays:
        name = raw[CONF_NAME]
        unique_id = raw.get("unique_id")
        haystack = f"{name} {unique_id or ''}".lower()
        event_type = (
            EVENT_TYPE_ANNIVERSARY
            if any(hint in haystack for hint in LEGACY_ANNIVERSARY_HINTS)
            else "birthday"
        )
        events.append(
            Event.create(
                name=name,
                date_=raw[CONF_DATE if CONF_DATE in raw else "date_of_birth"],
                event_type=event_type,
                event_id=unique_id,
                icon=raw.get(CONF_ICON),
                attributes=raw.get(CONF_ATTRIBUTES) or {},
            )
        )
    return events
