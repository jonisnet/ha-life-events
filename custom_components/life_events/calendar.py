"""Calendar platform: shows every tracked event on its (yearly recurring) date."""
from __future__ import annotations

from datetime import date, datetime, timedelta

from homeassistant.components.calendar import CalendarEntity, CalendarEvent
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, DOMAIN_FRIENDLY_NAME
from .manager import LifeEventsManager


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    manager: LifeEventsManager = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([LifeEventsCalendarEntity(manager)])


class LifeEventsCalendarEntity(CalendarEntity):
    """A single calendar entity aggregating every tracked event."""

    _attr_name = DOMAIN_FRIENDLY_NAME
    _attr_has_entity_name = False

    def __init__(self, manager: LifeEventsManager) -> None:
        self._manager = manager
        self._attr_unique_id = f"{DOMAIN}_calendar_{manager.entry_id}"

    @property
    def device_info(self) -> DeviceInfo:
        # Same identifier as EventEntity.device_info (entity.py), so the
        # calendar and every tracked event group under one shared device.
        return DeviceInfo(
            identifiers={(DOMAIN, self._manager.entry_id)},
            name=DOMAIN_FRIENDLY_NAME,
            manufacturer="jonisnet",
            model=DOMAIN_FRIENDLY_NAME,
            entry_type=DeviceEntryType.SERVICE,
        )

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(async_dispatcher_connect(self.hass, self._manager.signal, self._handle_update))

    @callback
    def _handle_update(self) -> None:
        self.async_write_ha_state()

    @property
    def event(self) -> CalendarEvent | None:
        today = date.today()
        upcoming = sorted(
            self._manager.events.values(),
            key=lambda e: e.days_until_next_occurrence(today),
        )
        for e in upcoming:
            occurrence = _next_occurrence(e.date, today)
            return _to_calendar_event(e.name, occurrence)
        return None

    async def async_get_events(self, hass: HomeAssistant, start_date: datetime, end_date: datetime) -> list[CalendarEvent]:
        events = []
        for e in self._manager.events.values():
            occurrence = _next_occurrence(e.date, start_date.date(), allow_past=True)
            while occurrence <= end_date.date():
                if occurrence >= start_date.date():
                    events.append(_to_calendar_event(e.name, occurrence))
                occurrence = occurrence.replace(year=occurrence.year + 1)
        return events


def _next_occurrence(source_date: date, today: date, allow_past: bool = False) -> date:
    occurrence = date(today.year, source_date.month, source_date.day)
    if not allow_past and occurrence < today:
        occurrence = occurrence.replace(year=today.year + 1)
    return occurrence


def _to_calendar_event(name: str, on_date: date) -> CalendarEvent:
    return CalendarEvent(start=on_date, end=on_date + timedelta(days=1), summary=name)
