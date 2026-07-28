"""Data model for a single tracked event (birthday, anniversary or deceased)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
import uuid

from homeassistant.util import slugify

from .const import (
    CONF_ATTRIBUTES,
    CONF_DATE,
    CONF_DATE_OF_DEATH,
    CONF_EVENT_TYPE,
    CONF_ICON,
    CONF_ID,
    CONF_NAME,
    DEFAULT_ICONS,
    EVENT_TYPE_BIRTHDAY,
)


def new_event_id(name: str, requested_id: str | None = None) -> str:
    """Build a stable, slugified id.

    Mirrors the slugify(unique_id or name) logic from the original YAML-only
    integration so entity_ids stay identical after migrating existing
    configuration.yaml entries (important: the user's dashboards/automations
    reference entity_ids like birthdays.frodo_baggins today).
    """
    base = requested_id or name
    slug = slugify(base)
    return slug or slugify(f"event-{uuid.uuid4().hex[:8]}")


@dataclass
class Event:
    id: str
    name: str
    date: date
    event_type: str = EVENT_TYPE_BIRTHDAY
    date_of_death: date | None = None
    icon: str | None = None
    attributes: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.icon:
            self.icon = DEFAULT_ICONS.get(self.event_type, "mdi:calendar-star")

    @classmethod
    def create(
        cls,
        name: str,
        date_: date,
        event_type: str = EVENT_TYPE_BIRTHDAY,
        event_id: str | None = None,
        date_of_death: date | None = None,
        icon: str | None = None,
        attributes: dict[str, str] | None = None,
    ) -> "Event":
        return cls(
            id=new_event_id(name, event_id),
            name=name,
            date=date_,
            event_type=event_type,
            date_of_death=date_of_death,
            icon=icon,
            attributes=dict(attributes or {}),
        )

    def to_storage_dict(self) -> dict:
        return {
            CONF_ID: self.id,
            CONF_NAME: self.name,
            CONF_EVENT_TYPE: self.event_type,
            CONF_DATE: self.date.isoformat(),
            CONF_DATE_OF_DEATH: self.date_of_death.isoformat() if self.date_of_death else None,
            CONF_ICON: self.icon,
            CONF_ATTRIBUTES: dict(self.attributes),
        }

    @classmethod
    def from_storage_dict(cls, raw: dict) -> "Event":
        return cls(
            id=raw[CONF_ID],
            name=raw[CONF_NAME],
            date=date.fromisoformat(raw[CONF_DATE]),
            event_type=raw.get(CONF_EVENT_TYPE, EVENT_TYPE_BIRTHDAY),
            date_of_death=date.fromisoformat(raw[CONF_DATE_OF_DEATH]) if raw.get(CONF_DATE_OF_DEATH) else None,
            icon=raw.get(CONF_ICON),
            attributes=dict(raw.get(CONF_ATTRIBUTES) or {}),
        )

    def days_until_next_occurrence(self, today: date) -> int:
        next_occurrence = date(today.year, self.date.month, self.date.day)
        if next_occurrence < today:
            next_occurrence = next_occurrence.replace(year=today.year + 1)
        return (next_occurrence - today).days

    def years_at_next_occurrence(self, today: date) -> int:
        next_occurrence = date(today.year, self.date.month, self.date.day)
        if next_occurrence < today:
            next_occurrence = next_occurrence.replace(year=today.year + 1)
        return next_occurrence.year - self.date.year
