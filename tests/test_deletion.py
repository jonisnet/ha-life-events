"""Tests that deleting an event fully purges it from HA, not just its state.

Regression test for: Entity.async_remove(force_remove=True) alone only
removes an entity's *state* - the entity *registry* entry is a separate
record it never touches, left as an orphan that HA's UI then reports as
"This entity is no longer available from the life_events integration...".
See LifeEventsManager._purge_entity() in manager.py for the fix.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.life_events.const import DOMAIN
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er


@pytest.fixture(autouse=True)
async def auto_enable_custom_integrations(enable_custom_integrations):
    yield


async def _setup_entry(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Life Events", data={})
    entry.add_to_hass(hass)
    with patch("custom_components.life_events._async_register_frontend", return_value=None):
        assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_delete_event_removes_the_entity_registry_entry(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await hass.services.async_call(
        DOMAIN, "add_event", {"name": "Frodo Baggins", "date": "1921-09-22"}, blocking=True
    )
    await hass.async_block_till_done()

    ent_reg = er.async_get(hass)
    assert ent_reg.async_get("life_events.frodo_baggins") is not None

    await hass.services.async_call(DOMAIN, "delete_event", {"event_id": "frodo_baggins"}, blocking=True)
    await hass.async_block_till_done()

    assert ent_reg.async_get("life_events.frodo_baggins") is None


async def test_delete_event_removes_the_state(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await hass.services.async_call(
        DOMAIN, "add_event", {"name": "Frodo Baggins", "date": "1921-09-22"}, blocking=True
    )
    await hass.async_block_till_done()
    assert hass.states.get("life_events.frodo_baggins") is not None

    await hass.services.async_call(DOMAIN, "delete_event", {"event_id": "frodo_baggins"}, blocking=True)
    await hass.async_block_till_done()

    assert hass.states.get("life_events.frodo_baggins") is None


async def test_import_replace_mode_removes_old_entities_registry_entries(hass: HomeAssistant) -> None:
    """Same bug class as delete_event: "replace" mode also permanently discards entities."""
    await _setup_entry(hass)
    await hass.services.async_call(
        DOMAIN, "add_event", {"name": "Frodo Baggins", "date": "1921-09-22"}, blocking=True
    )
    await hass.async_block_till_done()

    ent_reg = er.async_get(hass)
    assert ent_reg.async_get("life_events.frodo_baggins") is not None

    await hass.services.async_call(
        DOMAIN,
        "import_events",
        {"content": '[{"name": "Bilbo Baggins", "date": "1843-09-22"}]', "format": "json", "mode": "replace"},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert ent_reg.async_get("life_events.frodo_baggins") is None
    assert ent_reg.async_get("life_events.bilbo_baggins") is not None
