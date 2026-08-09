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
import mimetypes
from pathlib import Path

import voluptuous as vol
from aiohttp import web

from homeassistant.config_entries import SOURCE_IMPORT, ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers.entity_component import EntityComponent
from homeassistant.helpers.http import HomeAssistantView
from homeassistant.loader import async_get_integration

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

    # Event entities live directly in the life_events domain (life_events.*
    # entity_ids, not e.g. sensor.*), same as the old ha-birthdays. That
    # can't go through hass.config_entries.async_forward_entry_setups(entry,
    # [DOMAIN, ...]): ConfigEntry.async_setup() treats "forward to a
    # platform whose domain equals the integration's own domain" as
    # re-entering the SAME entry's setup (the domain_is_integration check in
    # HA core's config_entries.py), which always raises OperationNotAllowed
    # since we're calling this from inside that very setup call - confirmed
    # by tests/test_init.py actually exercising this against real HA core
    # rather than assuming it from reading the source. EntityComponent
    # .async_setup_entry() is the mechanism HA itself uses for entities that
    # live under their own integration's domain: it builds the
    # config-entry-bound EntityPlatform (which is what makes device/entity
    # registry linkage work) and loads our life_events.py platform module
    # directly, without going through that reentrancy-guarded path.
    component = EntityComponent(_LOGGER, DOMAIN, hass)
    hass.data[f"{DOMAIN}_component"] = component
    if not await component.async_setup_entry(entry):
        return False

    await hass.config_entries.async_forward_entry_setups(entry, [Platform.CALENDAR])

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, [Platform.CALENDAR])
    if not unload_ok:
        return False

    component: EntityComponent = hass.data.pop(f"{DOMAIN}_component")
    if not await component.async_unload_entry(entry):
        return False

    manager: LifeEventsManager = hass.data[DOMAIN].pop(entry.entry_id)
    await manager.async_unload()

    async_unregister_services(hass)
    return True


class _LifeEventsStaticView(HomeAssistantView):
    """Serve custom_components/life_events/www/*, always with Cache-Control: no-store.

    HA's built-in static-path registration (StaticPathConfig/
    register_static_path) only offers a binary choice: a 1-month "public"
    cache header, or no Cache-Control header at all. Neither actually
    prevents staleness on a tab that never does a fresh page load (e.g. a
    kiosk tablet left open for days) - the cache-busting ?v=<version> query
    string on the script URL only gets re-read when the *page* reloads and
    re-emits that URL; an already-open tab never asks again, regardless of
    what caching header the file was served with. no-store closes that gap
    at the root: nothing is allowed to cache this response at all, so
    there's no stale copy left anywhere to serve back next time.
    """

    url = f"{FRONTEND_URL_BASE}/{{filename:.+}}"
    name = "life_events:static"
    requires_auth = False

    def __init__(self, www_path: Path) -> None:
        self._www_path = www_path.resolve()

    async def get(self, request: web.Request, filename: str) -> web.Response:
        target = (self._www_path / filename).resolve()
        try:
            target.relative_to(self._www_path)
        except ValueError:
            raise web.HTTPForbidden from None
        if not target.is_file():
            raise web.HTTPNotFound from None

        hass: HomeAssistant = request.app["hass"]
        data = await hass.async_add_executor_job(target.read_bytes)
        content_type, _ = mimetypes.guess_type(str(target))
        return web.Response(
            body=data,
            content_type=content_type or "application/octet-stream",
            headers={"Cache-Control": "no-store"},
        )


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the bundled Lovelace cards and register them as a frontend resource."""
    if hass.data.get(f"{DOMAIN}_frontend_registered"):
        return
    hass.data[f"{DOMAIN}_frontend_registered"] = True

    www_path = Path(__file__).parent / "www"
    integration = await async_get_integration(hass, DOMAIN)
    # Still cache-busted on the integration version too, as a second line of
    # defense (some intermediate proxy/CDN setups only honor a changed URL,
    # not response headers) - but the no-store header below is what actually
    # closes the "already-open tab never re-fetches" gap.
    js_url = f"{FRONTEND_URL_BASE}/{CARD_FILENAME}?v={integration.version}"

    hass.http.register_view(_LifeEventsStaticView(www_path))

    add_extra_js_url = None
    try:
        from homeassistant.components.frontend import add_extra_js_url
    except ImportError:
        add_extra_js_url = None

    if add_extra_js_url is not None:
        add_extra_js_url(hass, js_url)

    _LOGGER.info("Life Events cards served at %s (add them as Lovelace resources if not auto-loaded)", js_url)
