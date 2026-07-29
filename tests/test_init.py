"""Integration-level tests for async_setup_entry / async_unload_entry.

Specifically verifies the fix for entities not being tied to the config
entry: before, EventEntity instances were added through a bare
EntityComponent (config_entry=None), so only the calendar entity showed up
grouped under the integration in the UI even though all "life_events.*"
entities existed and worked. Needs the real `homeassistant` package (not
the tests/_stubs fallback), so only meaningful in CI/full dev environments.
"""
from __future__ import annotations

from unittest.mock import patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.life_events.const import DOMAIN
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er


@pytest.fixture(autouse=True)
async def auto_enable_custom_integrations(enable_custom_integrations):
    # Must be async def, not plain def: under pytest-asyncio strict mode,
    # a sync fixture depending on the (async) enable_custom_integrations/
    # hass fixtures gets handed the unresolved async_generator object
    # instead of the awaited value.
    yield


async def _setup_entry(hass: HomeAssistant) -> MockConfigEntry:
    entry = MockConfigEntry(domain=DOMAIN, title="Life Events", data={})
    entry.add_to_hass(hass)
    # _async_register_frontend() needs the real `http`/`frontend` components
    # fully set up (the latter pulls in the `hass_frontend` static-assets
    # package, which isn't part of the test environment) - none of that is
    # what these tests are about (entity/device registry linkage), so mock
    # it out rather than dragging in unrelated, heavy setup.
    with patch("custom_components.life_events._async_register_frontend", return_value=None):
        assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_entities_are_tied_to_the_config_entry(hass: HomeAssistant) -> None:
    """The calendar entity alone used to show up; every event entity should now too."""
    entry = await _setup_entry(hass)

    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {"name": "Frodo Baggins", "date": "1921-09-22"},
        blocking=True,
    )
    await hass.async_block_till_done()

    ent_reg = er.async_get(hass)
    entries_for_config_entry = er.async_entries_for_config_entry(ent_reg, entry.entry_id)
    domains = {e.entity_id.split(".", 1)[0] for e in entries_for_config_entry}

    assert "calendar" in domains
    assert DOMAIN in domains, (
        f"life_events.* entities aren't tied to the config entry "
        f"(only found: {domains}) - the EntityComponent -> EntityPlatform fix regressed"
    )


async def test_only_calendar_has_a_device(hass: HomeAssistant) -> None:
    """Event entities deliberately have no device_info (see entity.py) - only the calendar does.

    Sharing one device across event entities used to prefix every person's
    friendly_name with the device name under HA's "legacy naming" rules
    (has_entity_name=False entities linked to a device), regardless of
    has_entity_name - not worth it for what was only a visual nicety.
    """
    entry = await _setup_entry(hass)

    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {"name": "Bilbo Baggins", "date": "1843-09-22"},
        blocking=True,
    )
    await hass.async_block_till_done()

    dev_reg = dr.async_get(hass)
    devices = dr.async_entries_for_config_entry(dev_reg, entry.entry_id)
    assert len(devices) == 1

    ent_reg = er.async_get(hass)
    entries_for_config_entry = er.async_entries_for_config_entry(ent_reg, entry.entry_id)
    assert len(entries_for_config_entry) >= 2  # calendar + at least the one event just added

    by_domain = {e.entity_id.split(".", 1)[0]: e for e in entries_for_config_entry}
    assert by_domain["calendar"].device_id == devices[0].id
    assert by_domain[DOMAIN].device_id is None


async def test_unload_entry_marks_entities_unavailable(hass: HomeAssistant) -> None:
    entry = await _setup_entry(hass)

    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {"name": "Sam Gamgee", "date": "1980-09-02"},
        blocking=True,
    )
    await hass.async_block_till_done()

    ent_reg = er.async_get(hass)
    entity_ids = [e.entity_id for e in er.async_entries_for_config_entry(ent_reg, entry.entry_id)]
    assert entity_ids  # sanity check: calendar + the event just added

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()

    # Unloading (default force_remove=False) marks entities unavailable
    # rather than deleting their state outright, and deliberately keeps
    # entity *registry* entries around too (that's what preserves
    # entity_id/area/customizations across a reload) - both only fully
    # disappear on complete entry removal (hass.config_entries.async_remove),
    # not a plain unload.
    for entity_id in entity_ids:
        state = hass.states.get(entity_id)
        assert state is not None and state.state == "unavailable"
