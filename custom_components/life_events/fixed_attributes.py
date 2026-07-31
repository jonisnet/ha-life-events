"""Persistent storage for the fixed/required custom-attribute schema.

Separate from LifeEventsStore (store.py) since this is schema, not event
data: a list of {"key": ..., "options": [...] | None} definitions configured
once via the Manage card's editor (not hardcoded into the integration, so it
doesn't get forced on other users' installs) and then enforced on every
add_event/update_event call and rendered on every card's edit form.
"""
from __future__ import annotations

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import CONF_FIXED_ATTRIBUTES, STORAGE_KEY_FIXED_ATTRIBUTES, STORAGE_VERSION


class FixedAttributesStore:
    """Wraps HA's Store helper to persist the fixed-attribute schema for one config entry."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self._store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY_FIXED_ATTRIBUTES}_{entry_id}")

    async def async_load(self) -> list[dict]:
        raw = await self._store.async_load()
        if not raw or CONF_FIXED_ATTRIBUTES not in raw:
            return []
        return raw[CONF_FIXED_ATTRIBUTES]

    async def async_save(self, fixed_attributes: list[dict]) -> None:
        await self._store.async_save({CONF_FIXED_ATTRIBUTES: fixed_attributes})
