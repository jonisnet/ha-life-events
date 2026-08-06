"""Persistent storage + import/export helpers for tracked events."""
from __future__ import annotations

import csv
import io
import json
import logging

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import (
    CSV_FIELDNAMES,
    FORMAT_CSV,
    FORMAT_JSON,
    STORAGE_KEY,
    STORAGE_VERSION,
)
from .models import Event, new_event_id

_LOGGER = logging.getLogger(__name__)


class LifeEventsStore:
    """Wraps HA's Store helper to persist the list of events for one config entry."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self._store = Store(hass, STORAGE_VERSION, f"{STORAGE_KEY}_{entry_id}")

    async def async_load(self) -> list[Event]:
        raw = await self._store.async_load()
        if not raw or "events" not in raw:
            return []
        events = []
        for raw_event in raw["events"]:
            try:
                events.append(Event.from_storage_dict(raw_event))
            except (KeyError, ValueError) as err:
                _LOGGER.warning("Skipping invalid stored event %s: %s", raw_event, err)
        return events

    async def async_save(self, events: list[Event]) -> None:
        await self._store.async_save({"events": [e.to_storage_dict() for e in events]})


def export_events(events: list[Event], fmt: str) -> str:
    """Serialize events to a CSV or JSON string."""
    if fmt == FORMAT_JSON:
        return json.dumps([e.to_storage_dict() for e in events], indent=2, ensure_ascii=False)

    if fmt == FORMAT_CSV:
        buffer = io.StringIO()
        writer = csv.DictWriter(buffer, fieldnames=CSV_FIELDNAMES)
        writer.writeheader()
        for event in events:
            row = event.to_storage_dict()
            row["attributes"] = json.dumps(row["attributes"], ensure_ascii=False)
            row["parent_ids"] = json.dumps(row["parent_ids"], ensure_ascii=False)
            row["partner_ids"] = json.dumps(row["partner_ids"], ensure_ascii=False)
            writer.writerow(row)
        return buffer.getvalue()

    raise ValueError(f"Unsupported export format: {fmt}")


def parse_events(content: str, fmt: str) -> list[Event]:
    """Parse a CSV or JSON string into a list of Event objects (ids kept if present)."""
    if fmt == FORMAT_JSON:
        raw_events = json.loads(content)
        return [_coerce_row(raw) for raw in raw_events]

    if fmt == FORMAT_CSV:
        events = []
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            attributes = row.get("attributes") or "{}"
            try:
                attributes = json.loads(attributes)
            except json.JSONDecodeError:
                attributes = {}
            parent_ids = row.get("parent_ids") or "[]"
            try:
                parent_ids = json.loads(parent_ids)
            except json.JSONDecodeError:
                parent_ids = []
            partner_ids = row.get("partner_ids") or "[]"
            try:
                partner_ids = json.loads(partner_ids)
            except json.JSONDecodeError:
                partner_ids = []
            # Only include a relationship-type key at all when the CSV
            # actually has a non-empty value for it - Event.from_storage_dict
            # (via _coerce_relationship_type) needs to distinguish "no
            # column in this export" (falls through to the legacy `married`
            # column, then to the default) from "column present but blank",
            # which a fixed `row.get(...)` literal here would collapse.
            relationship_fields = {}
            if row.get("relationship_type"):
                relationship_fields["relationship_type"] = row["relationship_type"]
            elif row.get("married"):
                relationship_fields["married"] = row["married"]
            events.append(
                _coerce_row(
                    {
                        "id": row.get("id") or None,
                        "name": row["name"],
                        "event_type": row.get("event_type") or "birthday",
                        "date": row["date"],
                        "date_of_death": row.get("date_of_death") or None,
                        "icon": row.get("icon") or None,
                        "phone_number": row.get("phone_number") or None,
                        "time": row.get("time") or None,
                        "spouse_id": row.get("spouse_id") or None,
                        "marriage_date": row.get("marriage_date") or None,
                        **relationship_fields,
                        "parent_ids": parent_ids,
                        "partner_ids": partner_ids,
                        "attributes": attributes,
                    }
                )
            )
        return events

    raise ValueError(f"Unsupported import format: {fmt}")


def _coerce_row(raw: dict) -> Event:
    """Ensure a row has a stable slugified id before turning it into an Event."""
    raw = dict(raw)
    raw["id"] = new_event_id(raw["name"], raw.get("id"))
    return Event.from_storage_dict(raw)
