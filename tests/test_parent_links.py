"""Tests for parent_ids linking (max 2, one-sided - see const.py's CONF_PARENT_IDS)."""
from __future__ import annotations

from unittest.mock import patch

import pytest
import voluptuous as vol
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


async def test_add_event_with_parent_ids_sets_the_attribute(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01")
    await _add_person(hass, "Moeder", "1952-01-01")
    await _add_person(hass, "Kind", "2010-01-01", parent_ids=["vader", "moeder"])

    kind = hass.states.get("life_events.kind")
    assert set(kind.attributes["parent_ids"]) == {"vader", "moeder"}
    assert set(kind.attributes["parent_names"]) == {"Vader", "Moeder"}


async def test_update_event_can_add_replace_and_clear_parent_ids(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01")
    await _add_person(hass, "Moeder", "1952-01-01")
    await _add_person(hass, "Stiefvader", "1955-01-01")
    await _add_person(hass, "Kind", "2010-01-01")

    await hass.services.async_call(
        DOMAIN, "update_event", {"event_id": "kind", "parent_ids": ["vader"]}, blocking=True
    )
    await hass.async_block_till_done()
    kind = hass.states.get("life_events.kind")
    assert kind.attributes["parent_ids"] == ["vader"]

    await hass.services.async_call(
        DOMAIN, "update_event", {"event_id": "kind", "parent_ids": ["stiefvader", "moeder"]}, blocking=True
    )
    await hass.async_block_till_done()
    kind = hass.states.get("life_events.kind")
    assert set(kind.attributes["parent_ids"]) == {"stiefvader", "moeder"}

    await hass.services.async_call(DOMAIN, "update_event", {"event_id": "kind", "parent_ids": []}, blocking=True)
    await hass.async_block_till_done()
    kind = hass.states.get("life_events.kind")
    assert "parent_ids" not in kind.attributes


async def test_updating_an_unrelated_field_preserves_parent_ids(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01")
    await _add_person(hass, "Kind", "2010-01-01", parent_ids=["vader"])

    await hass.services.async_call(DOMAIN, "update_event", {"event_id": "kind", "icon": "mdi:account"}, blocking=True)
    await hass.async_block_till_done()

    kind = hass.states.get("life_events.kind")
    assert kind.attributes["parent_ids"] == ["vader"]


async def test_more_than_two_parent_ids_rejected_by_schema(hass: HomeAssistant) -> None:
    """add_event's schema caps parent_ids at 2 via vol.Length(max=2) - this
    is rejected by voluptuous before the service handler (and manager's own
    _validate_parent_ids) ever runs. Accept either the raw voluptuous error
    or HA's own ServiceValidationError wrapper - which one surfaces is an HA
    core detail, not something this test should pin down."""
    await _setup_entry(hass)
    await _add_person(hass, "A", "1950-01-01")
    await _add_person(hass, "B", "1951-01-01")
    await _add_person(hass, "C", "1952-01-01")

    with pytest.raises((vol.Invalid, ServiceValidationError)):
        await hass.services.async_call(
            DOMAIN,
            "add_event",
            {"name": "Kind", "date": "2010-01-01", "parent_ids": ["a", "b", "c"]},
            blocking=True,
        )


async def test_duplicate_parent_id_rejected(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01")

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            "add_event",
            {"name": "Kind", "date": "2010-01-01", "parent_ids": ["vader", "vader"]},
            blocking=True,
        )


async def test_self_reference_rejected(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Kind", "2010-01-01")

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN, "update_event", {"event_id": "kind", "parent_ids": ["kind"]}, blocking=True
        )


async def test_unknown_parent_id_rejected(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Kind", "2010-01-01")

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN, "update_event", {"event_id": "kind", "parent_ids": ["nobody"]}, blocking=True
        )


async def test_direct_cycle_rejected(hass: HomeAssistant) -> None:
    """B is already A's parent - A can't then be set as B's parent too."""
    await _setup_entry(hass)
    await _add_person(hass, "A", "1950-01-01")
    await _add_person(hass, "B", "2010-01-01", parent_ids=["a"])

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(DOMAIN, "update_event", {"event_id": "a", "parent_ids": ["b"]}, blocking=True)


async def test_deleting_a_parent_clears_it_from_every_child(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01")
    await _add_person(hass, "Moeder", "1952-01-01")
    await _add_person(hass, "Kind1", "2010-01-01", parent_ids=["vader", "moeder"])
    await _add_person(hass, "Kind2", "2012-01-01", parent_ids=["vader"])

    await hass.services.async_call(DOMAIN, "delete_event", {"event_id": "vader"}, blocking=True)
    await hass.async_block_till_done()

    kind1 = hass.states.get("life_events.kind1")
    kind2 = hass.states.get("life_events.kind2")
    assert kind1.attributes["parent_ids"] == ["moeder"]
    assert "parent_ids" not in kind2.attributes


async def test_deleting_a_child_does_not_affect_the_parents_own_record(hass: HomeAssistant) -> None:
    """One-sided by design - no mirrored children_ids to clean up."""
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01")
    await _add_person(hass, "Kind", "2010-01-01", parent_ids=["vader"])

    await hass.services.async_call(DOMAIN, "delete_event", {"event_id": "kind"}, blocking=True)
    await hass.async_block_till_done()

    vader = hass.states.get("life_events.vader")
    assert vader is not None
    assert "parent_ids" not in vader.attributes  # never had any attribute of its own


async def test_parent_phone_numbers_only_includes_parents_with_a_phone_set(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01", phone_number="+31611111111")
    await _add_person(hass, "Moeder", "1952-01-01")
    await _add_person(hass, "Kind", "2010-01-01", parent_ids=["vader", "moeder"])

    kind = hass.states.get("life_events.kind")
    phones = kind.attributes["parent_phone_numbers"]
    assert len(phones) == 1
    assert phones[0]["name"] == "Vader"
    assert phones[0]["phone_number"] == "+31611111111"


async def test_a_deceased_person_can_be_linked_as_a_parent(hass: HomeAssistant) -> None:
    """Unlike the spouse picker, parent linking isn't restricted to birthday-type events."""
    await _setup_entry(hass)
    await _add_person(hass, "Opa", "1930-01-01", event_type="deceased", date_of_death="2020-01-01")
    await _add_person(hass, "Kind", "2010-01-01", parent_ids=["opa"])

    kind = hass.states.get("life_events.kind")
    assert kind.attributes["parent_ids"] == ["opa"]
    assert kind.attributes["parent_names"] == ["Opa"]
