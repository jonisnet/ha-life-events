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
    CONF_MARRIAGE_DATE,
    CONF_NAME,
    CONF_PARENT_IDS,
    CONF_PARTNER_IDS,
    CONF_PHONE_NUMBER,
    CONF_PRIMARY_CONTACT_ID,
    CONF_RELATIONSHIP_TYPE,
    CONF_SPOUSE_ID,
    CONF_TIME,
    DEFAULT_ICONS,
    EVENT_TYPE_BIRTHDAY,
    RELATIONSHIP_TYPE_MARRIED,
    RELATIONSHIP_TYPE_RELATIONSHIP,
    RELATIONSHIP_TYPES,
)

# The pre-relationship_type storage key ("married": bool) - kept only as a
# string literal here, not re-exported from const.py, so
# Event.from_storage_dict can still migrate a record saved before this field
# existed (see there). Not a real field name going forward.
_LEGACY_CONF_MARRIED = "married"


def _coerce_bool(value, default: bool) -> bool:
    """Coerce a storage/CSV value to bool, treating the literal string "False" as False.

    A naive `bool(value)` is wrong for CSV round-trips: CSV always stores
    booleans as the strings "True"/"False", and `bool("False")` is `True`
    in Python (any non-empty string is truthy) - would silently flip every
    unmarried partner back to "married" on export/import.
    """
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() not in ("false", "0", "no")


def _coerce_relationship_type(raw: dict) -> str:
    """Read relationship_type from a stored/CSV row, migrating a legacy
    `married: bool` record (from before this field existed) so an
    already-linked couple isn't lost on the next restart.

    store.py's CSV parse path only includes the "relationship_type"/
    "married" keys in `raw` when that CSV column actually had a non-empty
    value for this row - so a genuinely old export correctly falls through
    to the legacy branch below, rather than the key merely being present
    with an empty value shadowing the fallback.
    """
    value = raw.get(CONF_RELATIONSHIP_TYPE)
    if value:
        return value if value in RELATIONSHIP_TYPES else RELATIONSHIP_TYPE_MARRIED
    if _LEGACY_CONF_MARRIED in raw:
        return RELATIONSHIP_TYPE_MARRIED if _coerce_bool(raw.get(_LEGACY_CONF_MARRIED), True) else RELATIONSHIP_TYPE_RELATIONSHIP
    return RELATIONSHIP_TYPE_MARRIED


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
    phone_number: str | None = None
    time: str | None = None
    # Marriage link - see CONF_SPOUSE_ID/CONF_MARRIAGE_DATE in const.py.
    # Only ever set/cleared as a pair via LifeEventsManager's
    # async_link_marriage()/async_unlink_marriage(), never through plain
    # add_event/update_event (kept out of ADD/UPDATE_EVENT_SCHEMA in
    # services.py on purpose, so a caller can't desync one side of a link).
    spouse_id: str | None = None
    marriage_date: date | None = None
    # What kind of link the pair above is - see CONF_RELATIONSHIP_TYPE in
    # const.py. Only meaningful while spouse_id is set.
    relationship_type: str = RELATIONSHIP_TYPE_MARRIED
    # A child's 0-2 parents, by event id - see CONF_PARENT_IDS in const.py.
    # Unlike spouse_id/marriage_date, this rides the normal add/update_event
    # path (validated in LifeEventsManager._validate_parent_ids), since it's
    # one-sided and has no second record to keep in sync.
    parent_ids: list[str] = field(default_factory=list)
    # The two event ids this Event is a couple's-anniversary entity for -
    # see CONF_PARTNER_IDS in const.py. Only ever set by
    # LifeEventsManager._upsert_anniversary_entity, never through plain
    # add_event/update_event.
    partner_ids: list[str] = field(default_factory=list)
    # Whose phone_number counts as "primary" for automations - see
    # CONF_PRIMARY_CONTACT_ID in const.py. None means "my own". Rides the
    # normal add/update_event path like parent_ids, but unlike parent_ids
    # this value is re-validated for staleness on every read (in
    # entity.py), not just at write time.
    primary_contact_id: str | None = None
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
        phone_number: str | None = None,
        time: str | None = None,
        spouse_id: str | None = None,
        marriage_date: date | None = None,
        relationship_type: str = RELATIONSHIP_TYPE_MARRIED,
        parent_ids: list[str] | None = None,
        partner_ids: list[str] | None = None,
        primary_contact_id: str | None = None,
        attributes: dict[str, str] | None = None,
    ) -> "Event":
        return cls(
            id=new_event_id(name, event_id),
            name=name,
            date=date_,
            event_type=event_type,
            date_of_death=date_of_death,
            icon=icon,
            phone_number=phone_number or None,
            time=time or None,
            spouse_id=spouse_id or None,
            marriage_date=marriage_date,
            relationship_type=relationship_type,
            parent_ids=list(parent_ids or []),
            partner_ids=list(partner_ids or []),
            primary_contact_id=primary_contact_id or None,
            attributes=dict(attributes or {}),
        )

    def to_storage_dict(self) -> dict:
        return {
            CONF_ID: self.id,
            CONF_NAME: self.name,
            CONF_EVENT_TYPE: self.event_type,
            CONF_DATE: self.date.isoformat(),
            CONF_TIME: self.time,
            CONF_DATE_OF_DEATH: self.date_of_death.isoformat() if self.date_of_death else None,
            CONF_ICON: self.icon,
            CONF_PHONE_NUMBER: self.phone_number,
            CONF_SPOUSE_ID: self.spouse_id,
            CONF_MARRIAGE_DATE: self.marriage_date.isoformat() if self.marriage_date else None,
            CONF_RELATIONSHIP_TYPE: self.relationship_type,
            CONF_PARENT_IDS: list(self.parent_ids),
            CONF_PARTNER_IDS: list(self.partner_ids),
            CONF_PRIMARY_CONTACT_ID: self.primary_contact_id,
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
            phone_number=raw.get(CONF_PHONE_NUMBER) or None,
            time=raw.get(CONF_TIME) or None,
            spouse_id=raw.get(CONF_SPOUSE_ID) or None,
            marriage_date=date.fromisoformat(raw[CONF_MARRIAGE_DATE]) if raw.get(CONF_MARRIAGE_DATE) else None,
            relationship_type=_coerce_relationship_type(raw),
            parent_ids=list(raw.get(CONF_PARENT_IDS) or []),
            partner_ids=list(raw.get(CONF_PARTNER_IDS) or []),
            primary_contact_id=raw.get(CONF_PRIMARY_CONTACT_ID) or None,
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

    def days_until_next_death_anniversary(self, today: date) -> int | None:
        """Days until the next anniversary of date_of_death, or None if unset.

        Mirrors days_until_next_occurrence's forward-looking rollover logic
        exactly, just sourced from date_of_death instead of date - lets a
        deceased person's death anniversary be surfaced as its own upcoming
        occasion (see EventEntity.extra_state_attributes and the cards'
        expandDeceasedOccasions()), separate from their birthday occasion.
        """
        if not self.date_of_death:
            return None
        next_occurrence = date(today.year, self.date_of_death.month, self.date_of_death.day)
        if next_occurrence < today:
            next_occurrence = next_occurrence.replace(year=today.year + 1)
        return (next_occurrence - today).days

    def days_until_next_marriage_anniversary(self, today: date) -> int | None:
        """Days until the next wedding anniversary, or None if unmarried.

        Mirrors days_until_next_occurrence's forward-looking rollover logic,
        sourced from marriage_date - lets a married person's anniversary be
        surfaced as its own upcoming occasion, same pattern as
        days_until_next_death_anniversary above.
        """
        if not self.marriage_date:
            return None
        next_occurrence = date(today.year, self.marriage_date.month, self.marriage_date.day)
        if next_occurrence < today:
            next_occurrence = next_occurrence.replace(year=today.year + 1)
        return (next_occurrence - today).days

    def years_at_next_marriage_anniversary(self, today: date) -> int | None:
        """How many years married at the next anniversary, or None if unmarried.

        Mirrors years_at_next_occurrence's forward-looking rollover logic
        (ticks over ON the anniversary itself), sourced from marriage_date -
        the "25th anniversary" number shown alongside the occasion, and what
        a future per-language nickname (25=silver, 50=golden, ...) would key
        off of.
        """
        if not self.marriage_date:
            return None
        next_occurrence = date(today.year, self.marriage_date.month, self.marriage_date.day)
        if next_occurrence < today:
            next_occurrence = next_occurrence.replace(year=today.year + 1)
        return next_occurrence.year - self.marriage_date.year

    def years_since_death(self, today: date) -> int | None:
        """Complete years since date_of_death, counting up on each anniversary.

        Mirrors years_at_next_occurrence's rollover logic but looks
        backward (the most recently passed anniversary) instead of forward,
        since "years ago" should already read one higher on the anniversary
        date itself, the same way a birthday's age ticks over that day.
        Returns None if no date_of_death is set (optional field).
        """
        if not self.date_of_death:
            return None
        last_occurrence = date(today.year, self.date_of_death.month, self.date_of_death.day)
        if last_occurrence > today:
            last_occurrence = last_occurrence.replace(year=today.year - 1)
        return last_occurrence.year - self.date_of_death.year
