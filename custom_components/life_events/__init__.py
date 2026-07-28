"""The Life Events integration (birthdays, anniversaries, deceased loved ones).

Tracks birthdays, anniversaries and (optionally) deceased loved ones, fully
manageable from the HA interface: add/edit/delete/import/export. Ships its
own set of Lovelace cards (see custom_components/life_events/www) that are
auto-registered as a frontend resource.

A legacy `birthdays:` key in configuration.yaml (the key used by the old
ha-birthdays integration this project was renamed from) is still accepted
and is imported once into the new UI-managed storage the first time the
integration starts. That key is matched literally (LEGACY_YAML_KEY), not via
DOMAIN, since our own domain no longer shares the old integration's name.
"""
from __future__ import annotations

import logging
from pathlib import Path

import voluptuous as vol

from homeassistant.config_entries import SOURCE_IMPORT, ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
import homeassistant.helpers.config_validation as cv

from .const import CONF_ATTRIBUTES, CONF_BIRTHDAYS, CONF_GLOBAL_CONFIG, DOMAIN, LEGACY_YAML_KEY
from .manager import LifeEventsManager
from .services import async_register_services, async_unregister_services

_LOGGER = logging.getLogger(__name__)

BIRTHDAY_CONFIG_SCHEMA = vol.Schema(
    {
        vol.Optional("unique_id"): cv.string,
        vol.Required("name"): cv.string,
        vol.Required("date_of_birth"): cv.date,
        vol.Optional("icon", default="mdi:cake"): cv.string,
        vol.Optional(CONF_ATTRIBUTES, default={}): vol.Schema({cv.string: cv.string}),
    }
)

_OLD_YAML_SCHEMA = vol.Schema(
    {LEGACY_YAML_KEY: vol.All(cv.ensure_list, [BIRTHDAY_CONFIG_SCHEMA])}, extra=vol.ALLOW_EXTRA
)
_NEW_YAML_SCHEMA = vol.Schema(
    {
        LEGACY_YAML_KEY: {
            CONF_BIRTHDAYS: vol.All(cv.ensure_list, [BIRTHDAY_CONFIG_SCHEMA]),
            vol.Optional(CONF_GLOBAL_CONFIG, default={}): vol.Schema({}, extra=vol.ALLOW_EXTRA),
        }
    },
    extra=vol.ALLOW_EXTRA,
)

CONFIG_SCHEMA = vol.Schema(vol.Any(_OLD_YAML_SCHEMA, _NEW_YAML_SCHEMA), extra=vol.ALLOW_EXTRA)

FRONTEND_URL_BASE = "/life_events_static"
CARD_FILENAME = "life-events-cards.js"


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Pick up a legacy `birthdays:` YAML config, if any, and queue an import flow."""
    if LEGACY_YAML_KEY not in config:
        return True

    raw = config[LEGACY_YAML_KEY]
    birthdays = raw[CONF_BIRTHDAYS] if isinstance(raw, dict) and CONF_BIRTHDAYS in raw else raw

    hass.data.setdefault(DOMAIN, {})
    hass.data[f"{DOMAIN}_yaml_import"] = birthdays

    hass.async_create_task(
        hass.config_entries.flow.async_init(DOMAIN, context={"source": SOURCE_IMPORT}, data={})
    )
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    hass.data.setdefault(DOMAIN, {})

    legacy_yaml = hass.data.pop(f"{DOMAIN}_yaml_import", None)

    manager = LifeEventsManager(hass, entry.entry_id)
    await manager.async_setup(legacy_yaml)
    hass.data[DOMAIN][entry.entry_id] = manager

    async_register_services(hass)
    await _async_register_frontend(hass)

    await hass.config_entries.async_forward_entry_setups(entry, [Platform.CALENDAR])

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, [Platform.CALENDAR])
    if not unload_ok:
        return False

    manager: LifeEventsManager = hass.data[DOMAIN].pop(entry.entry_id)
    await manager.async_unload()

    async_unregister_services(hass)
    return True


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the bundled Lovelace cards and register them as a frontend resource."""
    if hass.data.get(f"{DOMAIN}_frontend_registered"):
        return
    hass.data[f"{DOMAIN}_frontend_registered"] = True

    www_path = Path(__file__).parent / "www"
    js_url = f"{FRONTEND_URL_BASE}/{CARD_FILENAME}"

    try:
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [StaticPathConfig(FRONTEND_URL_BASE, str(www_path), cache_headers=False)]
        )
    except ImportError:
        # Older HA core versions (pre 2024.7) use the sync registration call.
        hass.http.register_static_path(FRONTEND_URL_BASE, str(www_path), cache_headers=False)

    add_extra_js_url = None
    try:
        from homeassistant.components.frontend import add_extra_js_url
    except ImportError:
        add_extra_js_url = None

    if add_extra_js_url is not None:
        add_extra_js_url(hass, js_url)

    _LOGGER.info("Life Events cards served at %s (add them as Lovelace resources if not auto-loaded)", js_url)
