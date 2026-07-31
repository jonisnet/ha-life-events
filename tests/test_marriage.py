"""Tests for the link_marriage/unlink_marriage services (needs a running HA instance)."""
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


async def _add_person(hass: HomeAssistant, name: str, dob: str, **extra) -> None:
    await hass.services.async_call(DOMAIN, "add_event", {"name": name, "date": dob, **extra}, blocking=True)
    await hass.async_block_till_done()


async def test_link_marriage_sets_symmetric_attributes(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Cees", "1980-01-01")
    await _add_person(hass, "Nicole", "1982-05-05")

    await hass.services.async_call(
        DOMAIN,
        "link_marriage",
        {"event_id": "cees", "spouse_id": "nicole", "marriage_date": "2012-02-14"},
        blocking=True,
    )
    await hass.async_block_till_done()

    cees = hass.states.get("life_events.cees")
    nicole = hass.states.get("life_events.nicole")
    assert cees.attributes["spouse_id"] == "nicole"
    assert cees.attributes["spouse_name"] == "Nicole"
    assert cees.attributes["marriage_date"] == "2012-02-14"
    assert isinstance(cees.attributes["days_until_marriage_anniversary"], int)
    assert isinstance(cees.attributes["years_at_next_marriage_anniversary"], int)
    # Symmetric: the other side reflects the same link back.
    assert nicole.attributes["spouse_id"] == "cees"
    assert nicole.attributes["spouse_name"] == "Cees"
    assert nicole.attributes["marriage_date"] == "2012-02-14"


async def test_unmarried_event_has_no_marriage_attributes(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Frodo Baggins", "1921-09-22")

    state = hass.states.get("life_events.frodo_baggins")
    assert "spouse_id" not in state.attributes
    assert "marriage_date" not in state.attributes


async def test_unlink_marriage_clears_both_sides(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Cees", "1980-01-01")
    await _add_person(hass, "Nicole", "1982-05-05")
    await hass.services.async_call(
        DOMAIN, "link_marriage", {"event_id": "cees", "spouse_id": "nicole", "marriage_date": "2012-02-14"}, blocking=True
    )
    await hass.async_block_till_done()

    await hass.services.async_call(DOMAIN, "unlink_marriage", {"event_id": "cees"}, blocking=True)
    await hass.async_block_till_done()

    cees = hass.states.get("life_events.cees")
    nicole = hass.states.get("life_events.nicole")
    assert "spouse_id" not in cees.attributes
    assert "spouse_id" not in nicole.attributes


async def test_remarriage_while_old_spouse_still_alive_unlinks_them(hass: HomeAssistant) -> None:
    """A living "divorce then remarry" symmetrically frees the old spouse."""
    await _setup_entry(hass)
    await _add_person(hass, "Cees", "1980-01-01")
    await _add_person(hass, "Nicole", "1982-05-05")
    await _add_person(hass, "Marlene", "1985-03-03")
    await hass.services.async_call(
        DOMAIN, "link_marriage", {"event_id": "cees", "spouse_id": "nicole", "marriage_date": "2005-06-01"}, blocking=True
    )
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN, "link_marriage", {"event_id": "cees", "spouse_id": "marlene", "marriage_date": "2020-09-09"}, blocking=True
    )
    await hass.async_block_till_done()

    cees = hass.states.get("life_events.cees")
    nicole = hass.states.get("life_events.nicole")
    marlene = hass.states.get("life_events.marlene")
    assert cees.attributes["spouse_id"] == "marlene"
    assert marlene.attributes["spouse_id"] == "cees"
    assert "spouse_id" not in nicole.attributes  # old spouse freed, still alive


async def test_remarriage_after_widowhood_leaves_deceased_spouse_untouched(hass: HomeAssistant) -> None:
    """The deceased ex-spouse's own marriage history is left factually intact."""
    await _setup_entry(hass)
    await _add_person(hass, "Cees", "1980-01-01")
    await _add_person(hass, "Nicole", "1982-05-05")
    await _add_person(hass, "Marlene", "1985-03-03")
    await hass.services.async_call(
        DOMAIN, "link_marriage", {"event_id": "cees", "spouse_id": "nicole", "marriage_date": "2005-06-01"}, blocking=True
    )
    await hass.async_block_till_done()

    # Nicole passes away - Cees is now a widower, still linked to her.
    await hass.services.async_call(
        DOMAIN,
        "update_event",
        {"event_id": "nicole", "event_type": "deceased", "date_of_death": "2024-01-01"},
        blocking=True,
    )
    await hass.async_block_till_done()

    # Cees remarries Marlene.
    await hass.services.async_call(
        DOMAIN, "link_marriage", {"event_id": "cees", "spouse_id": "marlene", "marriage_date": "2025-05-05"}, blocking=True
    )
    await hass.async_block_till_done()

    cees = hass.states.get("life_events.cees")
    nicole = hass.states.get("life_events.nicole")
    marlene = hass.states.get("life_events.marlene")
    assert cees.attributes["spouse_id"] == "marlene"
    # Nicole's own record still shows the marriage to Cees she had in life.
    assert nicole.attributes["spouse_id"] == "cees"
    assert nicole.attributes["marriage_date"] == "2005-06-01"
    assert marlene.attributes["spouse_id"] == "cees"


async def test_deleting_a_married_person_frees_the_surviving_spouse(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Cees", "1980-01-01")
    await _add_person(hass, "Nicole", "1982-05-05")
    await hass.services.async_call(
        DOMAIN, "link_marriage", {"event_id": "cees", "spouse_id": "nicole", "marriage_date": "2012-02-14"}, blocking=True
    )
    await hass.async_block_till_done()

    await hass.services.async_call(DOMAIN, "delete_event", {"event_id": "cees"}, blocking=True)
    await hass.async_block_till_done()

    nicole = hass.states.get("life_events.nicole")
    assert "spouse_id" not in nicole.attributes


async def test_link_marriage_rejects_unknown_event_id(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Cees", "1980-01-01")

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN, "link_marriage", {"event_id": "cees", "spouse_id": "nobody", "marriage_date": "2012-02-14"}, blocking=True
        )


async def test_updating_an_unrelated_field_does_not_clear_the_marriage_link(hass: HomeAssistant) -> None:
    """update_event must preserve spouse_id/marriage_date like every other field it doesn't touch."""
    await _setup_entry(hass)
    await _add_person(hass, "Cees", "1980-01-01")
    await _add_person(hass, "Nicole", "1982-05-05")
    await hass.services.async_call(
        DOMAIN, "link_marriage", {"event_id": "cees", "spouse_id": "nicole", "marriage_date": "2012-02-14"}, blocking=True
    )
    await hass.async_block_till_done()

    await hass.services.async_call(DOMAIN, "update_event", {"event_id": "cees", "icon": "mdi:account"}, blocking=True)
    await hass.async_block_till_done()

    cees = hass.states.get("life_events.cees")
    assert cees.attributes["spouse_id"] == "nicole"
    assert cees.attributes["marriage_date"] == "2012-02-14"


async def test_link_marriage_rejects_marrying_self(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Cees", "1980-01-01")

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN, "link_marriage", {"event_id": "cees", "spouse_id": "cees", "marriage_date": "2012-02-14"}, blocking=True
        )
