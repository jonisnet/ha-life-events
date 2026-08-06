"""Tests for primary_contact_id (delegated phone number for automations, e.g. WhatsApp links).

Covers both the set-time guard (LifeEventsManager._validate_primary_contact_id)
and the read-time defensive resolution in entity.py (primary_contact_id is
re-checked against the CURRENT spouse_id/parent_ids on every read, not just
when it was set - so a stale delegate just falls back to the person's own
number instead of erroring).
"""
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


async def test_no_primary_contact_id_resolves_to_own_number(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Kind", "2010-01-01", phone_number="+31611111111")

    kind = hass.states.get("life_events.kind")
    assert kind.attributes["primary_phone_number"] == "+31611111111"
    assert kind.attributes["primary_contact_name"] == "Kind"
    assert kind.attributes["primary_whatsapp_link"] == "https://wa.me/31611111111"
    assert "primary_contact_id" not in kind.attributes


async def test_delegating_to_a_linked_parent_resolves_their_number(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01", phone_number="+31622222222")
    await _add_person(hass, "Kind", "2010-01-01", parent_ids=["vader"], primary_contact_id="vader")

    kind = hass.states.get("life_events.kind")
    assert kind.attributes["primary_contact_id"] == "vader"
    assert kind.attributes["primary_phone_number"] == "+31622222222"
    assert kind.attributes["primary_contact_name"] == "Vader"
    assert kind.attributes["primary_whatsapp_link"] == "https://wa.me/31622222222"


async def test_delegating_to_the_linked_spouse_resolves_their_number(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Cees", "1980-01-01")
    await _add_person(hass, "Nicole", "1982-01-01", phone_number="+31633333333")
    await hass.services.async_call(
        DOMAIN, "link_marriage", {"event_id": "cees", "spouse_id": "nicole", "marriage_date": "2012-02-14"}, blocking=True
    )
    await hass.async_block_till_done()

    await hass.services.async_call(
        DOMAIN, "update_event", {"event_id": "cees", "primary_contact_id": "nicole"}, blocking=True
    )
    await hass.async_block_till_done()

    cees = hass.states.get("life_events.cees")
    assert cees.attributes["primary_phone_number"] == "+31633333333"
    assert cees.attributes["primary_contact_name"] == "Nicole"


async def test_primary_contact_id_rejected_when_not_spouse_or_parent(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Onbekende", "1950-01-01")
    await _add_person(hass, "Kind", "2010-01-01")

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN, "update_event", {"event_id": "kind", "primary_contact_id": "onbekende"}, blocking=True
        )


async def test_primary_contact_id_rejected_at_add_time_if_not_among_new_parent_ids(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01")
    await _add_person(hass, "Ander", "1951-01-01")

    with pytest.raises(ServiceValidationError):
        await hass.services.async_call(
            DOMAIN,
            "add_event",
            {"name": "Kind", "date": "2010-01-01", "parent_ids": ["vader"], "primary_contact_id": "ander"},
            blocking=True,
        )


async def test_defensive_resolution_falls_back_to_own_number_after_divorce(hass: HomeAssistant) -> None:
    """Divorcing doesn't error or need an explicit primary_contact_id reset -
    resolution just stops honoring the now-stale delegate on its own."""
    await _setup_entry(hass)
    await _add_person(hass, "Cees", "1980-01-01", phone_number="+31611111111")
    await _add_person(hass, "Nicole", "1982-01-01", phone_number="+31622222222")
    await hass.services.async_call(
        DOMAIN, "link_marriage", {"event_id": "cees", "spouse_id": "nicole", "marriage_date": "2012-02-14"}, blocking=True
    )
    await hass.services.async_call(
        DOMAIN, "update_event", {"event_id": "cees", "primary_contact_id": "nicole"}, blocking=True
    )
    await hass.async_block_till_done()
    assert hass.states.get("life_events.cees").attributes["primary_phone_number"] == "+31622222222"

    await hass.services.async_call(DOMAIN, "unlink_marriage", {"event_id": "cees"}, blocking=True)
    await hass.async_block_till_done()

    cees = hass.states.get("life_events.cees")
    assert cees.attributes["primary_phone_number"] == "+31611111111"
    assert cees.attributes["primary_contact_name"] == "Cees"
    # The stale reference itself is left in place (not proactively cleared) -
    # only the resolved primary_phone_number/primary_contact_name self-heal.
    assert cees.attributes["primary_contact_id"] == "nicole"


async def test_defensive_resolution_falls_back_after_parent_removed_via_update(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01", phone_number="+31622222222")
    await _add_person(hass, "Kind", "2010-01-01", phone_number="+31611111111", parent_ids=["vader"], primary_contact_id="vader")
    assert hass.states.get("life_events.kind").attributes["primary_phone_number"] == "+31622222222"

    await hass.services.async_call(DOMAIN, "update_event", {"event_id": "kind", "parent_ids": []}, blocking=True)
    await hass.async_block_till_done()

    kind = hass.states.get("life_events.kind")
    assert kind.attributes["primary_phone_number"] == "+31611111111"
    assert kind.attributes["primary_contact_name"] == "Kind"


async def test_defensive_resolution_falls_back_after_parent_deleted(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01", phone_number="+31622222222")
    await _add_person(hass, "Kind", "2010-01-01", phone_number="+31611111111", parent_ids=["vader"], primary_contact_id="vader")
    assert hass.states.get("life_events.kind").attributes["primary_phone_number"] == "+31622222222"

    await hass.services.async_call(DOMAIN, "delete_event", {"event_id": "vader"}, blocking=True)
    await hass.async_block_till_done()

    kind = hass.states.get("life_events.kind")
    assert kind.attributes["primary_phone_number"] == "+31611111111"


async def test_no_primary_phone_number_when_nobody_involved_has_a_number(hass: HomeAssistant) -> None:
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01")
    await _add_person(hass, "Kind", "2010-01-01", parent_ids=["vader"], primary_contact_id="vader")

    kind = hass.states.get("life_events.kind")
    assert "primary_phone_number" not in kind.attributes
    assert "primary_whatsapp_link" not in kind.attributes
    assert kind.attributes["primary_contact_id"] == "vader"


async def test_update_event_with_empty_string_clears_primary_contact_id(hass: HomeAssistant) -> None:
    """The cards always send "" (never omit the key) to actually clear a
    previously set delegation - see validateAndBuildPayload in the cards."""
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01", phone_number="+31622222222")
    await _add_person(hass, "Kind", "2010-01-01", phone_number="+31611111111", parent_ids=["vader"], primary_contact_id="vader")
    assert hass.states.get("life_events.kind").attributes["primary_phone_number"] == "+31622222222"

    await hass.services.async_call(
        DOMAIN, "update_event", {"event_id": "kind", "primary_contact_id": ""}, blocking=True
    )
    await hass.async_block_till_done()

    kind = hass.states.get("life_events.kind")
    assert "primary_contact_id" not in kind.attributes
    assert kind.attributes["primary_phone_number"] == "+31611111111"


async def test_delegate_with_no_number_falls_back_to_own_number(hass: HomeAssistant) -> None:
    """A valid delegate that just hasn't had a number entered yet still lets
    the person's own number through, rather than exposing nothing at all."""
    await _setup_entry(hass)
    await _add_person(hass, "Vader", "1950-01-01")
    await _add_person(hass, "Kind", "2010-01-01", phone_number="+31611111111", parent_ids=["vader"], primary_contact_id="vader")

    kind = hass.states.get("life_events.kind")
    assert kind.attributes["primary_phone_number"] == "+31611111111"
    assert kind.attributes["primary_contact_name"] == "Kind"
