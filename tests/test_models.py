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


def test_years_since_death_before_anniversary_this_year():
    event = Event.create(
        name="Opa", date_=date(1930, 3, 3), event_type="deceased", date_of_death=date(2020, 11, 4)
    )
    # 2026-06-01 is before this year's Nov 4 anniversary, so the count
    # should still be from LAST year's anniversary (5), not tick over to 6
    # until Nov 4 itself.
    assert event.years_since_death(date(2026, 6, 1)) == 5


def test_years_since_death_on_the_anniversary_itself():
    event = Event.create(
        name="Opa", date_=date(1930, 3, 3), event_type="deceased", date_of_death=date(2020, 11, 4)
    )
    assert event.years_since_death(date(2026, 11, 4)) == 6


def test_years_since_death_after_anniversary_this_year():
    event = Event.create(
        name="Opa", date_=date(1930, 3, 3), event_type="deceased", date_of_death=date(2020, 11, 4)
    )
    assert event.years_since_death(date(2026, 11, 5)) == 6


def test_years_since_death_none_without_date_of_death():
    event = Event.create(name="Frodo Baggins", date_=date(1921, 9, 22))
    assert event.years_since_death(date(2026, 6, 1)) is None


def test_days_until_next_death_anniversary_wraps_to_next_year():
    event = Event.create(
        name="Opa", date_=date(1930, 3, 3), event_type="deceased", date_of_death=date(2020, 11, 4)
    )
    today = date(2026, 6, 1)
    assert event.days_until_next_death_anniversary(today) == (date(2026, 11, 4) - today).days


def test_days_until_next_death_anniversary_today_is_zero():
    event = Event.create(
        name="Opa", date_=date(1930, 3, 3), event_type="deceased", date_of_death=date(2020, 11, 4)
    )
    assert event.days_until_next_death_anniversary(date(2026, 11, 4)) == 0


def test_days_until_next_death_anniversary_none_without_date_of_death():
    event = Event.create(name="Frodo Baggins", date_=date(1921, 9, 22))
    assert event.days_until_next_death_anniversary(date(2026, 6, 1)) is None


def test_days_until_next_marriage_anniversary_wraps_to_next_year():
    event = Event.create(
        name="Cees", date_=date(1980, 1, 1), spouse_id="nicole", marriage_date=date(2012, 2, 14)
    )
    today = date(2026, 6, 1)
    assert event.days_until_next_marriage_anniversary(today) == (date(2027, 2, 14) - today).days


def test_days_until_next_marriage_anniversary_today_is_zero():
    event = Event.create(
        name="Cees", date_=date(1980, 1, 1), spouse_id="nicole", marriage_date=date(2012, 2, 14)
    )
    assert event.days_until_next_marriage_anniversary(date(2026, 2, 14)) == 0


def test_days_until_next_marriage_anniversary_none_when_unmarried():
    event = Event.create(name="Frodo Baggins", date_=date(1921, 9, 22))
    assert event.days_until_next_marriage_anniversary(date(2026, 6, 1)) is None


def test_years_at_next_marriage_anniversary():
    event = Event.create(
        name="Cees", date_=date(1980, 1, 1), spouse_id="nicole", marriage_date=date(2012, 2, 14)
    )
    # Before this year's Feb 14 anniversary -> still counting toward it.
    assert event.years_at_next_marriage_anniversary(date(2026, 1, 1)) == 2026 - 2012
    # After it -> already rolled over to next year's count.
    assert event.years_at_next_marriage_anniversary(date(2026, 6, 1)) == 2027 - 2012


def test_years_at_next_marriage_anniversary_none_when_unmarried():
    event = Event.create(name="Frodo Baggins", date_=date(1921, 9, 22))
    assert event.years_at_next_marriage_anniversary(date(2026, 6, 1)) is None


def test_spouse_id_and_marriage_date_roundtrip_through_storage():
    event = Event.create(
        name="Cees", date_=date(1980, 1, 1), spouse_id="nicole", marriage_date=date(2012, 2, 14)
    )
    restored = Event.from_storage_dict(event.to_storage_dict())
    assert restored.spouse_id == "nicole"
    assert restored.marriage_date == date(2012, 2, 14)


def test_spouse_id_and_marriage_date_default_to_none():
    event = Event.create(name="Frodo Baggins", date_=date(1921, 9, 22))
    assert event.spouse_id is None
    assert event.marriage_date is None


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


def test_relationship_type_defaults_to_married():
    event = Event.create(name="Frodo Baggins", date_=date(1921, 9, 22))
    assert event.relationship_type == "married"


def test_relationship_type_relationship_roundtrips_through_storage():
    event = Event.create(name="Cees", date_=date(1980, 1, 1), spouse_id="nicole", relationship_type="relationship")
    restored = Event.from_storage_dict(event.to_storage_dict())
    assert restored.relationship_type == "relationship"


def test_relationship_type_registered_partnership_roundtrips_through_storage():
    event = Event.create(name="Cees", date_=date(1980, 1, 1), spouse_id="nicole", relationship_type="registered_partnership")
    restored = Event.from_storage_dict(event.to_storage_dict())
    assert restored.relationship_type == "registered_partnership"


def test_legacy_married_true_migrates_to_relationship_type_married():
    """A record saved before relationship_type existed (married: True) must
    still load correctly - the boolean's only prior value that meant an
    actual marriage."""
    raw = Event.create(name="Cees", date_=date(1980, 1, 1), spouse_id="nicole").to_storage_dict()
    del raw["relationship_type"]
    raw["married"] = True
    restored = Event.from_storage_dict(raw)
    assert restored.relationship_type == "married"


def test_legacy_married_false_migrates_to_relationship_type_relationship():
    """A legacy married: False record predates the 3-way enum, so it can
    only unambiguously map to the informal "relationship" type - not
    registered_partnership, which didn't exist as a concept yet."""
    raw = Event.create(name="Cees", date_=date(1980, 1, 1), spouse_id="nicole").to_storage_dict()
    del raw["relationship_type"]
    raw["married"] = False
    restored = Event.from_storage_dict(raw)
    assert restored.relationship_type == "relationship"


def test_legacy_married_string_false_migrates_correctly():
    """Regression test: bool("False") is True in Python - a naive coercion
    on the CSV-round-tripped legacy `married` column would silently flip
    every already-unmarried partner back to "married" on the next
    export/import, or on this migration path specifically."""
    raw = Event.create(name="Cees", date_=date(1980, 1, 1), spouse_id="nicole").to_storage_dict()
    del raw["relationship_type"]
    raw["married"] = "False"
    restored = Event.from_storage_dict(raw)
    assert restored.relationship_type == "relationship"


def test_no_relationship_type_or_legacy_married_key_defaults_to_married():
    raw = Event.create(name="Cees", date_=date(1980, 1, 1), spouse_id="nicole").to_storage_dict()
    del raw["relationship_type"]
    restored = Event.from_storage_dict(raw)
    assert restored.relationship_type == "married"


def test_csv_export_import_roundtrip_keeps_relationship_type_relationship():
    events = [Event.create(name="Cees", date_=date(1980, 1, 1), spouse_id="nicole", relationship_type="relationship")]
    content = export_events(events, "csv")
    parsed = parse_events(content, "csv")
    assert parsed[0].relationship_type == "relationship"


def test_csv_export_import_roundtrip_keeps_relationship_type_married():
    events = [Event.create(name="Cees", date_=date(1980, 1, 1), spouse_id="nicole", relationship_type="married")]
    content = export_events(events, "csv")
    parsed = parse_events(content, "csv")
    assert parsed[0].relationship_type == "married"


def test_partner_ids_defaults_to_empty_list():
    event = Event.create(name="Frodo Baggins", date_=date(1921, 9, 22))
    assert event.partner_ids == []


def test_partner_ids_roundtrips_through_storage():
    event = Event.create(name="Anniversary", date_=date(2012, 2, 14), partner_ids=["cees", "nicole"])
    restored = Event.from_storage_dict(event.to_storage_dict())
    assert restored.partner_ids == ["cees", "nicole"]


def test_csv_export_import_roundtrip_keeps_partner_ids():
    events = [Event.create(name="Anniversary", date_=date(2012, 2, 14), partner_ids=["cees", "nicole"])]
    content = export_events(events, "csv")
    parsed = parse_events(content, "csv")
    assert parsed[0].partner_ids == ["cees", "nicole"]


def test_parent_ids_defaults_to_empty_list():
    event = Event.create(name="Frodo Baggins", date_=date(1921, 9, 22))
    assert event.parent_ids == []


def test_parent_ids_roundtrips_through_storage():
    event = Event.create(name="Kind", date_=date(2010, 1, 1), parent_ids=["ouder_1", "ouder_2"])
    restored = Event.from_storage_dict(event.to_storage_dict())
    assert restored.parent_ids == ["ouder_1", "ouder_2"]


def test_csv_export_import_roundtrip_keeps_parent_ids():
    events = [Event.create(name="Kind", date_=date(2010, 1, 1), parent_ids=["ouder_1", "ouder_2"])]
    content = export_events(events, "csv")
    parsed = parse_events(content, "csv")
    assert parsed[0].parent_ids == ["ouder_1", "ouder_2"]
