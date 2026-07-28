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

# Event fields
CONF_ID = "id"
CONF_NAME = "name"
CONF_EVENT_TYPE = "event_type"
CONF_DATE = "date"
CONF_DATE_OF_DEATH = "date_of_death"
CONF_ICON = "icon"
CONF_ATTRIBUTES = "attributes"

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

ATTR_FORMAT = "format"
ATTR_CONTENT = "content"
ATTR_MODE = "mode"

IMPORT_MODE_MERGE = "merge"
IMPORT_MODE_REPLACE = "replace"

FORMAT_CSV = "csv"
FORMAT_JSON = "json"

CSV_FIELDNAMES = [CONF_ID, CONF_NAME, CONF_EVENT_TYPE, CONF_DATE, CONF_DATE_OF_DEATH, CONF_ICON, CONF_ATTRIBUTES]
