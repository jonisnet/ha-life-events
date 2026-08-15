"""Registers the card JS as a real Lovelace resource, not via add_extra_js_url.

`add_extra_js_url` injects the script tag fresh on every frontend page load
from an in-memory list - it works, but users have reported the card getting
stuck after an update until a manual browser hard-refresh. A resource added
the normal way (Settings -> Dashboards -> Resources, or what HACS itself
does for "Plugin"-category repos) does not have that problem - it goes
through Lovelace's own resources storage collection, the same code path the
"Add Resource" dialog uses.

This mirrors that: create/update our entry in `lovelace.resources` directly
via its public async_create_item/async_update_item methods. This touches
`hass.data["lovelace"]`, which is an internal object, not a documented
`homeassistant.helpers` API - there's no dedicated public API for a
third-party integration to do this. If anything about its shape doesn't
match what's expected, this fails soft and the caller falls back to the
always-works add_extra_js_url injection - never a crash, just the previous
(still-functional) behavior.
"""
from __future__ import annotations

import logging

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

RESOURCE_TYPE = "module"


class LovelaceResourceRegistration:
    def __init__(self, hass: HomeAssistant, js_path: str) -> None:
        self.hass = hass
        self._js_path = js_path  # e.g. "/life_events_static/life-events-cards.js", no ?v=

    async def async_try_register(self, version: str) -> bool:
        """Create/update our Lovelace resource entry. Returns False (never
        raises) if the caller should fall back to add_extra_js_url instead."""
        lovelace = self.hass.data.get("lovelace")
        if lovelace is None:
            return False
        try:
            if lovelace.mode != "storage":
                return False
            if not lovelace.resources.loaded:
                # Rare (very early in startup) - don't block config entry
                # setup waiting for it. The fallback covers this session.
                return False
            await self._async_create_or_update(lovelace, version)
            return True
        except Exception as err:  # noqa: BLE001 - any shape mismatch, just fall back
            _LOGGER.debug("Could not register as a Lovelace resource, falling back: %s", err)
            return False

    async def _async_create_or_update(self, lovelace, version: str) -> None:
        url = f"{self._js_path}?v={version}"
        existing = [r for r in lovelace.resources.async_items() if r["url"].split("?")[0] == self._js_path]
        if existing:
            if existing[0]["url"] != url:
                await lovelace.resources.async_update_item(existing[0]["id"], {"res_type": RESOURCE_TYPE, "url": url})
        else:
            await lovelace.resources.async_create_item({"res_type": RESOURCE_TYPE, "url": url})
