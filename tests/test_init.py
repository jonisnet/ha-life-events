"""Integration-level tests for async_setup_entry / async_unload_entry.

Specifically verifies the fix for entities not being tied to the config
entry: before, EventEntity instances were added through a bare
EntityComponent (config_entry=None), so only the calendar entity showed up
grouped under the integration in the UI even though all "life_events.*"
entities existed and worked. Needs the real `homeassistant` package (not
the tests/_stubs fallback), so only meaningful in CI/full dev environments.
"""
from __future__ import annotations

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.life_events.const import DOMAIN
from homeassistant.core import HomeAssistant
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.setup import async_setup_component


@pytest.fixture(autouse=True)
async def auto_enable_custom_integrations(enable_custom_integrations):
    # Must be async def, not plain def: under pytest-asyncio strict mode,
    # a sync fixture depending on the (async) enable_custom_integrations/
    # hass fixtures gets handed the unresolved async_generator object
    # instead of the awaited value.
    yield


async def _setup_entry(hass: HomeAssistant) -> MockConfigEntry:
    # The bare `hass` fixture doesn't set up the `http`/`frontend` components,
    # unlike a real HA instance (where they're always loaded before custom
    # integrations get set up). Our _async_register_frontend() needs
    # hass.http to not be None and add_extra_js_url() needs frontend's
    # hass.data key to already exist, so set both up explicitly here rather
    # than in the integration itself - production code shouldn't guard
    # against a state that can't actually occur outside a minimal test
    # harness.
    await async_setup_component(hass, "http", {})
    await async_setup_component(hass, "frontend", {})
    entry = MockConfigEntry(domain=DOMAIN, title="Life Events", data={})
    entry.add_to_hass(hass)
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


async def test_calendar_and_events_share_one_device(hass: HomeAssistant) -> None:
    """Both entity kinds declare the same device identifier; there should be exactly one device."""
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
    assert all(e.device_id == devices[0].id for e in entries_for_config_entry)


async def test_unload_entry_removes_all_entities(hass: HomeAssistant) -> None:
    entry = await _setup_entry(hass)

    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {"name": "Sam Gamgee", "date": "1980-09-02"},
        blocking=True,
    )
    await hass.async_block_till_done()

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()

    ent_reg = er.async_get(hass)
    assert er.async_entries_for_config_entry(ent_reg, entry.entry_id) == []
