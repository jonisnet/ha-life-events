"""Tests for the fixed/required custom-attribute schema (set/get services + enforcement)."""
from __future__ import annotations

from unittest.mock import patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.life_events.const import DOMAIN
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ServiceValidationError


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


async def test_get_fixed_attributes_starts_empty(hass: HomeAssistant) -> None:
    await _setup_entry(hass)

    result = await hass.services.async_call(
        DOMAIN, "get_fixed_attributes", {}, blocking=True, return_response=True
    )
    assert result["fixed_attributes"] == []


async def test_set_and_get_fixed_attributes_roundtrip(hass: HomeAssistant) -> None:
    await _setup_entry(hass)

    schema = [{"key": "geslacht", "options": ["man", "vrouw", "anders"]}]
    await hass.services.async_call(
        DOMAIN, "set_fixed_attributes", {"fixed_attributes": schema}, blocking=True
    )
    await hass.async_block_till_done()

    result = await hass.services.async_call(
        DOMAIN, "get_fixed_attributes", {}, blocking=True, return_response=True
    )
    assert result["fixed_attributes"] == schema


async def test_add_event_rejects_missing_required_attribute(hass: HomeAssistant) -> None:
    """A direct add_event call bypassing the card UI must still be enforced."""
    await _setup_entry(hass)
    await hass.services.async_call(
        DOMAIN,
        "set_fixed_attributes",
        {"fixed_attributes": [{"key": "geslacht"}]},
        blocking=True,
    )
    await hass.async_block_till_done()

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            "add_event",
            {"name": "Frodo Baggins", "date": "1921-09-22"},
            blocking=True,
        )


async def test_add_event_succeeds_when_required_attribute_present(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await hass.services.async_call(
        DOMAIN,
        "set_fixed_attributes",
        {"fixed_attributes": [{"key": "geslacht"}]},
        blocking=True,
    )
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {"name": "Frodo Baggins", "date": "1921-09-22", "attributes": {"geslacht": "man"}},
        blocking=True,
    )
    await hass.async_block_till_done()

    state = hass.states.get("life_events.frodo_baggins")
    assert state is not None
    assert state.attributes["geslacht"] == "man"


async def test_update_event_rejects_clearing_a_required_attribute(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {"name": "Bilbo Baggins", "date": "1843-09-22", "attributes": {"geslacht": "man"}},
        blocking=True,
    )
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        "set_fixed_attributes",
        {"fixed_attributes": [{"key": "geslacht"}]},
        blocking=True,
    )
    await hass.async_block_till_done()

    # Explicitly wiping attributes on update (as the card's edit form always
    # does - it resends the whole attributes dict) must be rejected, not
    # silently accepted, once "geslacht" is required.
    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            "update_event",
            {"event_id": "bilbo_baggins", "attributes": {}},
            blocking=True,
        )


async def test_update_event_without_touching_attributes_keeps_passing_validation(
    hass: HomeAssistant,
) -> None:
    """Omitting `attributes` entirely on update_event keeps the event's existing values."""
    await _setup_entry(hass)
    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {"name": "Sam Gamgee", "date": "1980-09-02", "attributes": {"geslacht": "man"}},
        blocking=True,
    )
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        "set_fixed_attributes",
        {"fixed_attributes": [{"key": "geslacht"}]},
        blocking=True,
    )
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN,
        "update_event",
        {"event_id": "sam_gamgee", "icon": "mdi:star"},
        blocking=True,
    )
    await hass.async_block_till_done()

    state = hass.states.get("life_events.sam_gamgee")
    assert state.attributes["geslacht"] == "man"
    assert state.attributes["icon"] == "mdi:star"
