"""Tests for computed entity attributes that depend on a running HA instance."""
from __future__ import annotations

from unittest.mock import patch

import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.life_events.const import DOMAIN
from homeassistant.core import HomeAssistant


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


async def test_deceased_event_exposes_years_since_death(hass: HomeAssistant) -> None:
    await _setup_entry(hass)

    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {
            "name": "Opa",
            "date": "1930-03-03",
            "event_type": "deceased",
            "date_of_death": "2020-11-04",
        },
        blocking=True,
    )
    await hass.async_block_till_done()

    state = hass.states.get("life_events.opa")
    assert state is not None
    assert "years_since_death" in state.attributes
    assert isinstance(state.attributes["years_since_death"], int)
    assert state.attributes["years_since_death"] >= 0


async def test_non_deceased_event_has_no_years_since_death(hass: HomeAssistant) -> None:
    await _setup_entry(hass)

    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {"name": "Frodo Baggins", "date": "1921-09-22"},
        blocking=True,
    )
    await hass.async_block_till_done()

    state = hass.states.get("life_events.frodo_baggins")
    assert "years_since_death" not in state.attributes


async def test_deceased_event_without_date_of_death_has_no_years_since_death(
    hass: HomeAssistant,
) -> None:
    await _setup_entry(hass)

    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {"name": "Onbekend", "date": "1930-03-03", "event_type": "deceased"},
        blocking=True,
    )
    await hass.async_block_till_done()

    state = hass.states.get("life_events.onbekend")
    assert "years_since_death" not in state.attributes


async def test_deceased_event_exposes_days_until_death_anniversary(hass: HomeAssistant) -> None:
    await _setup_entry(hass)

    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {
            "name": "Opa",
            "date": "1930-03-03",
            "event_type": "deceased",
            "date_of_death": "2020-11-04",
        },
        blocking=True,
    )
    await hass.async_block_till_done()

    state = hass.states.get("life_events.opa")
    assert "days_until_death_anniversary" in state.attributes
    assert isinstance(state.attributes["days_until_death_anniversary"], int)
    assert state.attributes["days_until_death_anniversary"] >= 0


async def test_deceased_event_without_date_of_death_has_no_days_until_death_anniversary(
    hass: HomeAssistant,
) -> None:
    await _setup_entry(hass)

    await hass.services.async_call(
        DOMAIN,
        "add_event",
        {"name": "Onbekend", "date": "1930-03-03", "event_type": "deceased"},
        blocking=True,
    )
    await hass.async_block_till_done()

    state = hass.states.get("life_events.onbekend")
    assert "days_until_death_anniversary" not in state.attributes
