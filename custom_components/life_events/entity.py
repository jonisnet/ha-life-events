"""The entity representing a single tracked event."""
from __future__ import annotations

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er, label_registry as lr
from homeassistant.helpers.entity import Entity
from homeassistant.util import dt as dt_util

from .const import CONF_AGE_AT_NEXT_BIRTHDAY, CONF_DATE_OF_BIRTH, DOMAIN, DOMAIN_FRIENDLY_NAME, EVENT_TYPE_DECEASED


@callback
def apply_life_events_label(hass: HomeAssistant, entity_id: str) -> None:
    """Ensure entity_id carries the shared "Life Events" label.

    Entities aren't grouped under a device (see EventEntity's
    _attr_has_entity_name comment below), so this label is what lets users
    find/filter every entity belonging to this integration via Settings ->
    Areas, labels & zones despite that. Only adds the label if missing -
    never touches any other labels the user may have set themselves.
    """
    label_reg = lr.async_get(hass)
    label = label_reg.async_get_label_by_name(DOMAIN_FRIENDLY_NAME)
    if label is None:
        label = label_reg.async_create(DOMAIN_FRIENDLY_NAME, icon="mdi:cake")

    ent_reg = er.async_get(hass)
    entry = ent_reg.async_get(entity_id)
    if entry is not None and label.label_id not in entry.labels:
        ent_reg.async_update_entity(entity_id, labels=entry.labels | {label.label_id})


class EventEntity(Entity):
    """State = days until the next occurrence of the event's date."""

    should_poll = False
    # No device_info here (deliberately - see git history for the version
    # that tried this): as of HA 2026.x, "legacy naming" (has_entity_name
    # False) entities linked to a device always get "<device name> <entity
    # name>" as their computed friendly_name (homeassistant/helpers/
    # entity_registry.py's _async_get_full_entity_name), regardless of
    # has_entity_name - that's what caused every person's entity to show up
    # as "Life Events <name>". Being tied to the config entry (via
    # EntityComponent in __init__.py) is what actually makes entities show
    # up under Settings -> Devices & services -> Life Events; grouping them
    # under one shared device on top of that was only a visual nicety, not
    # required, and isn't worth this side effect for 100+ entities. The
    # calendar entity (calendar.py) keeps its own device since it's a
    # single, uniquely-named entity that displays cleanly either way.
    _attr_has_entity_name = False

    def __init__(self, manager, event_id: str) -> None:
        self._manager = manager
        self._event_id = event_id
        self.entity_id = f"{DOMAIN}.{event_id}"

    async def async_added_to_hass(self) -> None:
        # Applied here, not at registration time in manager.py: the entity
        # registry entry is only guaranteed to exist once this callback
        # fires.
        apply_life_events_label(self.hass, self.entity_id)

    @property
    def _event(self):
        return self._manager.events.get(self._event_id)

    @property
    def unique_id(self) -> str:
        return self._event_id

    @property
    def name(self) -> str | None:
        event = self._event
        return event.name if event else None

    @property
    def icon(self) -> str | None:
        event = self._event
        return event.icon if event else None

    @property
    def state(self):
        event = self._event
        if not event:
            return None
        today = dt_util.start_of_local_day().date()
        return event.days_until_next_occurrence(today)

    @property
    def unit_of_measurement(self) -> str | None:
        return "days" if self.state != 1 else "day"

    @property
    def extra_state_attributes(self) -> dict:
        event = self._event
        if not event:
            return {}
        today = dt_util.start_of_local_day().date()
        attrs = dict(event.attributes)
        # `date_of_birth` is kept as the attribute name for every event type
        # (not just birthdays) on purpose: existing dashboards/templates built
        # against the old integration read ent.attributes.date_of_birth
        # regardless of what the event represents, so renaming it would be a
        # silent breaking change.
        attrs[CONF_DATE_OF_BIRTH] = event.date.isoformat()
        attrs[CONF_AGE_AT_NEXT_BIRTHDAY] = event.years_at_next_occurrence(today)
        attrs["event_type"] = event.event_type
        if event.event_type == EVENT_TYPE_DECEASED and event.date_of_death:
            attrs["date_of_death"] = event.date_of_death.isoformat()
            years_since_death = event.years_since_death(today)
            if years_since_death is not None:
                attrs["years_since_death"] = years_since_death
            days_until_death_anniversary = event.days_until_next_death_anniversary(today)
            if days_until_death_anniversary is not None:
                attrs["days_until_death_anniversary"] = days_until_death_anniversary
        if event.spouse_id:
            attrs["spouse_id"] = event.spouse_id
            spouse = self._manager.events.get(event.spouse_id)
            # Resolved here (not left to the frontend to look up its own
            # entity_id) since the manager already has every event in
            # memory - one less hass.states lookup for every card that
            # wants to show "married to X since Y".
            if spouse:
                attrs["spouse_name"] = spouse.name
            attrs["relationship_type"] = event.relationship_type
            # marriage_date is optional - the exact date isn't always known
            # (e.g. a couple already together before this integration
            # existed) - the link is still real without it, just without an
            # anniversary occasion until it's filled in later.
            if event.marriage_date:
                attrs["marriage_date"] = event.marriage_date.isoformat()
                days_until_marriage_anniversary = event.days_until_next_marriage_anniversary(today)
                if days_until_marriage_anniversary is not None:
                    attrs["days_until_marriage_anniversary"] = days_until_marriage_anniversary
                years_at_next_marriage_anniversary = event.years_at_next_marriage_anniversary(today)
                if years_at_next_marriage_anniversary is not None:
                    attrs["years_at_next_marriage_anniversary"] = years_at_next_marriage_anniversary
        if event.parent_ids:
            attrs["parent_ids"] = list(event.parent_ids)
            parent_names = []
            parent_phone_numbers = []
            for parent_id in event.parent_ids:
                # Resolved here for the same reason spouse_name is above -
                # the manager already has every event in memory.
                parent = self._manager.events.get(parent_id)
                if parent:
                    parent_names.append(parent.name)
                    if parent.phone_number:
                        parent_phone_numbers.append({"name": parent.name, "phone_number": parent.phone_number})
            if parent_names:
                attrs["parent_names"] = parent_names
            if parent_phone_numbers:
                attrs["parent_phone_numbers"] = parent_phone_numbers
        # Only ever set on an auto-created couple's-anniversary entity
        # (see LifeEventsManager._upsert_anniversary_entity) - mutually
        # exclusive with the spouse_id block above, since a person has
        # spouse_id and this kind of entity has partner_ids, never both.
        if event.partner_ids:
            attrs["partner_ids"] = list(event.partner_ids)
            attrs["relationship_type"] = event.relationship_type
            partner_names = []
            for partner_id in event.partner_ids:
                partner = self._manager.events.get(partner_id)
                if partner:
                    partner_names.append(partner.name)
            if partner_names:
                attrs["partner_names"] = partner_names
        # "Children of X" is the reverse of parent_ids - deliberately not
        # stored anywhere (no mirrored children_ids field, see
        # CONF_PARENT_IDS in const.py), computed here by scanning every
        # other event for whoever lists this one as a parent. Same
        # read-time-resolution spirit as spouse_name/parent_names above,
        # just a reverse scan instead of a direct id lookup since there's
        # no reverse index.
        children = [other for other in self._manager.events.values() if event.id in other.parent_ids]
        if children:
            attrs["children_ids"] = [child.id for child in children]
            attrs["children_names"] = [child.name for child in children]
        if event.phone_number:
            attrs["phone_number"] = event.phone_number
        if event.time:
            attrs["time"] = event.time
        return attrs
