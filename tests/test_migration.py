"""Tests for the legacy `birthdays:` YAML -> Event migration heuristic."""
from datetime import date

from custom_components.life_events.manager import _events_from_legacy_yaml


def test_plain_birthday_stays_a_birthday():
    raw = [{"name": "Frodo Baggins", "unique_id": None, "date_of_birth": date(1921, 9, 22)}]
    events = _events_from_legacy_yaml(raw)
    assert events[0].event_type == "birthday"


def test_trouwdag_entry_becomes_an_anniversary():
    # Real-world case: trouwdagen.yaml is merged into the same `birthdays:` key
    # via !include_dir_merge_list, with entries like this one.
    raw = [
        {
            "name": "Trouwdag Cees & Nicole",
            "unique_id": "Trouwdag C&N",
            "date_of_birth": date(2012, 2, 14),
        }
    ]
    events = _events_from_legacy_yaml(raw)
    assert events[0].event_type == "anniversary"
    assert events[0].id == "trouwdag_c_n"


def test_mixed_list_classifies_each_entry_independently():
    raw = [
        {"name": "Cindy Uitbeijerse", "unique_id": "verjaardag cindy", "date_of_birth": date(1998, 1, 5)},
        {"name": "Trouwdag Martin & Jacqueline", "unique_id": "Trouwdag M&J", "date_of_birth": date(1988, 7, 4)},
    ]
    events = _events_from_legacy_yaml(raw)
    by_name = {e.name: e for e in events}
    assert by_name["Cindy Uitbeijerse"].event_type == "birthday"
    assert by_name["Trouwdag Martin & Jacqueline"].event_type == "anniversary"


def test_legacy_attributes_are_preserved():
    raw = [
        {
            "name": "Kyara Deitelzweig Senior",
            "unique_id": "verjaardag Kyara",
            "date_of_birth": date(2010, 1, 1),
            "attributes": {"maand": "januari", "geslacht": "Vrouw", "connectie": "Familie Mijling"},
        }
    ]
    events = _events_from_legacy_yaml(raw)
    assert events[0].attributes["connectie"] == "Familie Mijling"
