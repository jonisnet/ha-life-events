"""The 'life_events' platform of the life_events integration.

This looks circular, but it's the standard way for an integration to have
entities directly under its own domain (matching a platform-name-equals-
component-name lookup). Loaded via EntityComponent.async_setup_entry() in
__init__.py, NOT via hass.config_entries.async_forward_entry_setups() -
that call would treat "forward to a platform whose domain equals the
integration's own domain" as re-entering the entry's own setup and reject
it (see the comment in __init__.py's async_setup_entry). Either way, this
module receives a real, config-entry-bound async_add_entities callback, so
the resulting entities are correctly tied to the config entry (and thus
groupable into a device), unlike the bare EntityComponent used before this
was fixed.
"""
from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .manager import LifeEventsManager


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    manager: LifeEventsManager = hass.data[DOMAIN][entry.entry_id]
    await manager.async_setup_entities(async_add_entities)
