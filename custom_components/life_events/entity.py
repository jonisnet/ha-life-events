"""The entity representing a single tracked event."""
from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity import Entity
from homeassistant.util import dt as dt_util

from .const import CONF_AGE_AT_NEXT_BIRTHDAY, CONF_DATE_OF_BIRTH, DOMAIN, DOMAIN_FRIENDLY_NAME, EVENT_TYPE_DECEASED


class EventEntity(Entity):
    """State = days until the next occurrence of the event's date."""

    should_poll = False
    # Explicit, not just relying on the base class default: without this,
    # HA prefixes the shared "Life Events" device name onto every person's
    # friendly_name ("Life Events Jazlyn Propitius") once the entity is
    # linked to a device - only surfaced once the entity/device-grouping
    # fix actually started working. calendar.py already sets this
    # explicitly for the same reason; this entity never did.
    _attr_has_entity_name = False

    def __init__(self, manager, event_id: str) -> None:
        self._manager = manager
        self._event_id = event_id
        self.entity_id = f"{DOMAIN}.{event_id}"

    @property
    def device_info(self) -> DeviceInfo:
        # Every event and the calendar entity (see calendar.py) share this
        # same identifier, so they're grouped under one device instead of
        # being scattered as ungrouped entities on the integration page.
        return DeviceInfo(
            identifiers={(DOMAIN, self._manager.entry_id)},
            name=DOMAIN_FRIENDLY_NAME,
            manufacturer="jonisnet",
            model=DOMAIN_FRIENDLY_NAME,
            entry_type=DeviceEntryType.SERVICE,
        )

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
        if event.phone_number:
            attrs["phone_number"] = event.phone_number
        return attrs
