"""Pure-logic tests: no running Home Assistant instance required."""
from datetime import date

from custom_components.life_events.models import Event, new_event_id
from custom_components.life_events.store import export_events, parse_events


def test_new_event_id_matches_legacy_slugify_behaviour():
    # Mirrors the original YAML-only integration: slugify(unique_id) if given,
    # else slugify(name). This must stay stable so existing entity_ids
    # (referenced by the user's dashboards/automations) survive migration.
    assert new_event_id("Frodo Baggins", None) == "frodo_baggins"
    assert new_event_id("James Bond", "bond_james_bond") == "bond_james_bond"
    assert new_event_id("Sven-Göran Eriksson", None) == "sven_goran_eriksson"


def test_days_until_next_occurrence_wraps_to_next_year():
    event = Event.create(name="Elvis", date_=date(1935, 1, 8))
    today = date(2026, 6, 1)
    assert event.days_until_next_occurrence(today) == (date(2027, 1, 8) - today).days


def test_days_until_next_occurrence_today_is_zero():
    event = Event.create(name="Elvis", date_=date(1935, 6, 1))
    today = date(2026, 6, 1)
    assert event.days_until_next_occurrence(today) == 0


def test_years_at_next_occurrence():
    event = Event.create(name="Elvis", date_=date(1935, 1, 8))
    assert event.years_at_next_occurrence(date(2026, 6, 1)) == 2027 - 1935


def test_deceased_event_keeps_date_of_death():
    event = Event.create(
        name="Opa",
        date_=date(1930, 3, 3),
        event_type="deceased",
        date_of_death=date(2020, 11, 4),
    )
    stored = event.to_storage_dict()
    restored = Event.from_storage_dict(stored)
    assert restored.date_of_death == date(2020, 11, 4)
    assert restored.event_type == "deceased"


def test_json_export_import_roundtrip():
    events = [
        Event.create(name="Frodo Baggins", date_=date(1921, 9, 22)),
        Event.create(name="Trouwdag Cees & Nicole", date_=date(2012, 2, 14), event_type="anniversary"),
    ]
    content = export_events(events, "json")
    parsed = parse_events(content, "json")
    assert {e.name for e in parsed} == {e.name for e in events}
    assert {e.id for e in parsed} == {e.id for e in events}


def test_csv_export_import_roundtrip_keeps_attributes():
    events = [
        Event.create(
            name="Kyara Deitelzweig Senior",
            date_=date(2010, 1, 1),
            event_id="verjaardag Kyara",
            attributes={"maand": "januari", "connectie": "Familie Mijling"},
        )
    ]
    content = export_events(events, "csv")
    parsed = parse_events(content, "csv")
    assert len(parsed) == 1
    assert parsed[0].attributes["connectie"] == "Familie Mijling"
    assert parsed[0].id == new_event_id("Kyara Deitelzweig Senior", "verjaardag Kyara")


def test_phone_number_roundtrips_through_storage():
    event = Event.create(name="Frodo Baggins", date_=date(1921, 9, 22), phone_number="+31612345678")
    restored = Event.from_storage_dict(event.to_storage_dict())
    assert restored.phone_number == "+31612345678"


def test_phone_number_defaults_to_none():
    event = Event.create(name="Frodo Baggins", date_=date(1921, 9, 22))
    assert event.phone_number is None


def test_csv_export_import_roundtrip_keeps_phone_number():
    events = [Event.create(name="Bilbo Baggins", date_=date(1843, 9, 22), phone_number="+31612345678")]
    content = export_events(events, "csv")
    parsed = parse_events(content, "csv")
    assert parsed[0].phone_number == "+31612345678"


def test_time_roundtrips_through_storage():
    event = Event.create(name="Peregrin Took", date_=date(1990, 4, 1), time="14:37")
    restored = Event.from_storage_dict(event.to_storage_dict())
    assert restored.time == "14:37"


def test_time_defaults_to_none():
    event = Event.create(name="Frodo Baggins", date_=date(1921, 9, 22))
    assert event.time is None


def test_csv_export_import_roundtrip_keeps_time():
    events = [Event.create(name="Peregrin Took", date_=date(1990, 4, 1), time="14:37")]
    content = export_events(events, "csv")
    parsed = parse_events(content, "csv")
    assert parsed[0].time == "14:37"
