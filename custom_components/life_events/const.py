"""Constants for the Life Events integration."""
from __future__ import annotations

DOMAIN = "life_events"
DOMAIN_FRIENDLY_NAME = "Life Events"

# Fixed regardless of DOMAIN: the top-level YAML key the old ha-birthdays
# integration used (domain was literally "birthdays" there). Upgraders coming
# straight from that legacy YAML setup still have this key in their
# configuration.yaml, so we look for it explicitly rather than via DOMAIN.
LEGACY_YAML_KEY = "birthdays"

PLATFORMS: list[str] = []  # calendar is forwarded manually, entities live directly in the life_events domain

STORAGE_VERSION = 1
STORAGE_KEY = f"{DOMAIN}_events"
STORAGE_KEY_FIXED_ATTRIBUTES = f"{DOMAIN}_fixed_attributes"

# Event fields
CONF_ID = "id"
CONF_NAME = "name"
CONF_EVENT_TYPE = "event_type"
CONF_DATE = "date"
CONF_DATE_OF_DEATH = "date_of_death"
CONF_ICON = "icon"
CONF_ATTRIBUTES = "attributes"
# Only meaningful for birthday/anniversary events (enforced in the UI, not
# the storage model - a deceased event just never gets one set).
CONF_PHONE_NUMBER = "phone_number"
# Optional, purely informational (no arithmetic done on it) - stored as a
# plain "HH:MM" string, not a real time object. Rarely known for existing
# entries, but often printed on a birth announcement card for a newborn.
CONF_TIME = "time"
# Marriage link: `spouse_id` points at the OTHER person's event id,
# `marriage_date` is the shared anniversary date - stored redundantly on
# both spouses' own records (not as a 3rd linked entity) so the marriage
# survives either side's deletion/lookup independently, mirroring how
# other per-record fields in this file work. Set/cleared together via
# LifeEventsManager.async_link_marriage()/async_unlink_marriage(), never
# directly through add_event/update_event.
CONF_SPOUSE_ID = "spouse_id"
CONF_MARRIAGE_DATE = "marriage_date"
# What kind of link spouse_id/marriage_date represents. Default is
# "married" - the only case that existed before this field was added, so
# every pre-existing linked record migrates cleanly (see
# Event.from_storage_dict's legacy-`married`-boolean fallback). Same
# set/cleared-only-via-link/unlink-marriage rule as the two fields above.
CONF_RELATIONSHIP_TYPE = "relationship_type"
RELATIONSHIP_TYPE_MARRIED = "married"
RELATIONSHIP_TYPE_REGISTERED_PARTNERSHIP = "registered_partnership"
RELATIONSHIP_TYPE_RELATIONSHIP = "relationship"
RELATIONSHIP_TYPES = [
    RELATIONSHIP_TYPE_MARRIED,
    RELATIONSHIP_TYPE_REGISTERED_PARTNERSHIP,
    RELATIONSHIP_TYPE_RELATIONSHIP,
]
# A child's 0-2 parents, by event id - stored only on the child's own
# record (deliberately NOT mirrored as e.g. children_ids on the parent's
# record - "children of X" is computed on read by scanning for whoever has
# X in their own parent_ids, same spirit as spouse_name's read-time
# resolution in entity.py). Settable through the normal add/update_event
# services, unlike spouse_id/marriage_date - see manager.py's
# _validate_parent_ids for why this one doesn't need its own link/unlink
# service (no second record to keep in sync).
CONF_PARENT_IDS = "parent_ids"
# The two event ids a couple's auto-created anniversary Event is between -
# only ever set on that kind of Event (event_type=EVENT_TYPE_ANNIVERSARY,
# created/updated by LifeEventsManager._upsert_anniversary_entity, never
# through add_event/update_event). Doubles as the marker distinguishing an
# auto-created couple's-anniversary entity from an ordinary/legacy-imported
# standalone anniversary Event, which has no partner_ids at all.
CONF_PARTNER_IDS = "partner_ids"

# Legacy YAML fields (kept so existing configuration.yaml keeps validating during import)
CONF_UNIQUE_ID = "unique_id"
CONF_DATE_OF_BIRTH = "date_of_birth"
CONF_GLOBAL_CONFIG = "config"
CONF_BIRTHDAYS = "birthdays"

CONF_AGE_AT_NEXT_BIRTHDAY = "age_at_next_birthday"

EVENT_TYPE_BIRTHDAY = "birthday"
EVENT_TYPE_ANNIVERSARY = "anniversary"
EVENT_TYPE_DECEASED = "deceased"

EVENT_TYPES = [EVENT_TYPE_BIRTHDAY, EVENT_TYPE_ANNIVERSARY, EVENT_TYPE_DECEASED]

DEFAULT_ICONS = {
    EVENT_TYPE_BIRTHDAY: "mdi:cake",
    EVENT_TYPE_ANNIVERSARY: "mdi:ring",
    EVENT_TYPE_DECEASED: "mdi:flower",
}

# Heuristic used only once, during migration of the legacy `birthdays:` YAML list:
# entries whose name/unique_id contain this word are treated as anniversaries
# instead of birthdays (this matches how trouwdagen.yaml was historically mixed
# into the same `birthdays:` YAML key).
LEGACY_ANNIVERSARY_HINTS = ("trouwdag", "jubileum", "anniversary")

SIGNAL_EVENTS_UPDATED = f"{DOMAIN}_events_updated"

EVENT_BIRTHDAY = "birthday"

SERVICE_ADD_EVENT = "add_event"
SERVICE_UPDATE_EVENT = "update_event"
SERVICE_DELETE_EVENT = "delete_event"
SERVICE_IMPORT_EVENTS = "import_events"
SERVICE_EXPORT_EVENTS = "export_events"
SERVICE_SET_FIXED_ATTRIBUTES = "set_fixed_attributes"
SERVICE_GET_FIXED_ATTRIBUTES = "get_fixed_attributes"
SERVICE_LINK_MARRIAGE = "link_marriage"
SERVICE_UNLINK_MARRIAGE = "unlink_marriage"

# A fixed-attribute definition: {"key": str, "options": list[str] | None}.
# `options` absent/None means a required free-text field; present means a
# required dropdown restricted to those values. Per-installation, not
# hardcoded into the integration - configured via the Manage card's editor
# and persisted via FixedAttributesStore (see fixed_attributes.py).
CONF_FIXED_ATTRIBUTES = "fixed_attributes"
CONF_FIXED_ATTR_KEY = "key"
CONF_FIXED_ATTR_OPTIONS = "options"

ATTR_FORMAT = "format"
ATTR_CONTENT = "content"
ATTR_MODE = "mode"

IMPORT_MODE_MERGE = "merge"
IMPORT_MODE_REPLACE = "replace"

FORMAT_CSV = "csv"
FORMAT_JSON = "json"

CSV_FIELDNAMES = [
    CONF_ID,
    CONF_NAME,
    CONF_EVENT_TYPE,
    CONF_DATE,
    CONF_TIME,
    CONF_DATE_OF_DEATH,
    CONF_ICON,
    CONF_PHONE_NUMBER,
    CONF_SPOUSE_ID,
    CONF_MARRIAGE_DATE,
    CONF_RELATIONSHIP_TYPE,
    CONF_PARENT_IDS,
    CONF_PARTNER_IDS,
    CONF_ATTRIBUTES,
]
