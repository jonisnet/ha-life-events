"""Runtime manager: owns the event list, storage, entities and services."""
from __future__ import annotations

import logging
from datetime import date, timedelta

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.entity_component import EntityComponent
from homeassistant.helpers.event import async_call_later
from homeassistant.util import dt as dt_util

from .const import (
    CONF_ATTRIBUTES,
    CONF_DATE,
    CONF_DATE_OF_DEATH,
    CONF_EVENT_TYPE,
    CONF_ICON,
    CONF_NAME,
    DOMAIN,
    EVENT_TYPE_ANNIVERSARY,
    LEGACY_ANNIVERSARY_HINTS,
    SIGNAL_EVENTS_UPDATED,
)
from .entity import EventEntity
from .models import Event, new_event_id
from .store import LifeEventsStore, export_events, parse_events

_LOGGER = logging.getLogger(__name__)


class LifeEventsManager:
    """Owns the list of events for one config entry and keeps entities in sync."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self.hass = hass
        self.entry_id = entry_id
        self.store = LifeEventsStore(hass, entry_id)
        self.component = EntityComponent(_LOGGER, DOMAIN, hass)
        self.events: dict[str, Event] = {}
        self._unsub_midnight = None

    @property
    def signal(self) -> str:
        return f"{SIGNAL_EVENTS_UPDATED}_{self.entry_id}"

    async def async_setup(self, legacy_yaml_birthdays: list[dict] | None) -> None:
        events = await self.store.async_load()

        if not events and legacy_yaml_birthdays:
            _LOGGER.info(
                "No stored events yet, importing %d entries from configuration.yaml",
                len(legacy_yaml_birthdays),
            )
            events = _events_from_legacy_yaml(legacy_yaml_birthdays)
            await self.store.async_save(events)

        self.events = {e.id: e for e in events}
        await self.component.async_add_entities(
            [EventEntity(self, event_id) for event_id in self.events]
        )
        self._recompute_states()
        self._schedule_midnight_update()

    async def async_unload(self) -> None:
        if self._unsub_midnight:
            self._unsub_midnight()
        for entity in list(self.component.entities):
            await entity.async_remove(force_remove=True)

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
        for entity in self.component.entities:
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

    # -- CRUD -----------------------------------------------------------------

    async def async_add_event(self, **fields) -> Event:
        event = Event.create(**fields)
        self.events[event.id] = event
        await self.store.async_save(list(self.events.values()))
        await self.component.async_add_entities([EventEntity(self, event.id)])
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
            "attributes": fields.get("attributes", current.attributes),
        }
        updated = Event.create(**merged)
        self.events[event_id] = updated
        await self.store.async_save(list(self.events.values()))
        entity = self.component.get_entity(f"{DOMAIN}.{event_id}")
        if entity:
            entity.async_write_ha_state()
        async_dispatcher_send(self.hass, self.signal)
        return updated

    async def async_delete_event(self, event_id: str) -> None:
        if event_id not in self.events:
            return
        del self.events[event_id]
        await self.store.async_save(list(self.events.values()))
        entity = self.component.get_entity(f"{DOMAIN}.{event_id}")
        if entity:
            await entity.async_remove(force_remove=True)
        async_dispatcher_send(self.hass, self.signal)

    async def async_import_events(self, content: str, fmt: str, mode: str) -> int:
        new_events = parse_events(content, fmt)

        if mode == "replace":
            for entity in list(self.component.entities):
                await entity.async_remove(force_remove=True)
            self.events = {}

        for event in new_events:
            self.events[event.id] = event

        await self.store.async_save(list(self.events.values()))

        existing_ids = {e.entity_id.split(".", 1)[1] for e in self.component.entities}
        to_add = [EventEntity(self, e.id) for e in new_events if e.id not in existing_ids]
        if to_add:
            await self.component.async_add_entities(to_add)

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
