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
        if event.phone_number:
            attrs["phone_number"] = event.phone_number
        if event.time:
            attrs["time"] = event.time
        return attrs
