"""Services: add/update/delete/import/export events, callable from the cards."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
import homeassistant.helpers.config_validation as cv

from .const import (
    DOMAIN,
    EVENT_TYPES,
    FORMAT_CSV,
    FORMAT_JSON,
    IMPORT_MODE_MERGE,
    IMPORT_MODE_REPLACE,
    SERVICE_ADD_EVENT,
    SERVICE_DELETE_EVENT,
    SERVICE_EXPORT_EVENTS,
    SERVICE_IMPORT_EVENTS,
    SERVICE_UPDATE_EVENT,
)

ADD_EVENT_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Required("date"): cv.date,
        vol.Optional("event_type", default="birthday"): vol.In(EVENT_TYPES),
        vol.Optional("event_id"): cv.string,
        vol.Optional("date_of_death"): cv.date,
        vol.Optional("icon"): cv.string,
        vol.Optional("attributes", default={}): {cv.string: cv.string},
    }
)

UPDATE_EVENT_SCHEMA = vol.Schema(
    {
        vol.Required("event_id"): cv.string,
        vol.Optional("name"): cv.string,
        vol.Optional("date"): cv.date,
        vol.Optional("event_type"): vol.In(EVENT_TYPES),
        vol.Optional("date_of_death"): cv.date,
        vol.Optional("icon"): cv.string,
        vol.Optional("attributes"): {cv.string: cv.string},
    }
)

DELETE_EVENT_SCHEMA = vol.Schema({vol.Required("event_id"): cv.string})

IMPORT_EVENTS_SCHEMA = vol.Schema(
    {
        vol.Required("content"): cv.string,
        vol.Optional("format", default=FORMAT_JSON): vol.In([FORMAT_CSV, FORMAT_JSON]),
        vol.Optional("mode", default=IMPORT_MODE_MERGE): vol.In([IMPORT_MODE_MERGE, IMPORT_MODE_REPLACE]),
    }
)

EXPORT_EVENTS_SCHEMA = vol.Schema({vol.Optional("format", default=FORMAT_JSON): vol.In([FORMAT_CSV, FORMAT_JSON])})


def _manager_for_call(hass: HomeAssistant, call: ServiceCall):
    """There is only ever a single config entry (single_instance_allowed)."""
    managers = hass.data.get(DOMAIN, {})
    if not managers:
        raise RuntimeError("Life Events integration is not set up")
    return next(iter(managers.values()))


def async_register_services(hass: HomeAssistant) -> None:
    if hass.services.has_service(DOMAIN, SERVICE_ADD_EVENT):
        return  # services are shared across the (single) config entry

    async def _add_event(call: ServiceCall) -> ServiceResponse:
        manager = _manager_for_call(hass, call)
        fields = dict(call.data)
        fields["date_"] = fields.pop("date")
        event = await manager.async_add_event(**fields)
        return {"id": event.id}

    async def _update_event(call: ServiceCall) -> ServiceResponse:
        manager = _manager_for_call(hass, call)
        fields = dict(call.data)
        event_id = fields.pop("event_id")
        if "date" in fields:
            fields["date_"] = fields.pop("date")
        event = await manager.async_update_event(event_id, **fields)
        return {"id": event.id}

    async def _delete_event(call: ServiceCall) -> None:
        manager = _manager_for_call(hass, call)
        await manager.async_delete_event(call.data["event_id"])

    async def _import_events(call: ServiceCall) -> ServiceResponse:
        manager = _manager_for_call(hass, call)
        count = await manager.async_import_events(call.data["content"], call.data["format"], call.data["mode"])
        return {"imported": count}

    async def _export_events(call: ServiceCall) -> ServiceResponse:
        manager = _manager_for_call(hass, call)
        return {"content": manager.export_events(call.data["format"]), "format": call.data["format"]}

    hass.services.async_register(DOMAIN, SERVICE_ADD_EVENT, _add_event, schema=ADD_EVENT_SCHEMA, supports_response=SupportsResponse.OPTIONAL)
    hass.services.async_register(DOMAIN, SERVICE_UPDATE_EVENT, _update_event, schema=UPDATE_EVENT_SCHEMA, supports_response=SupportsResponse.OPTIONAL)
    hass.services.async_register(DOMAIN, SERVICE_DELETE_EVENT, _delete_event, schema=DELETE_EVENT_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_IMPORT_EVENTS, _import_events, schema=IMPORT_EVENTS_SCHEMA, supports_response=SupportsResponse.OPTIONAL)
    hass.services.async_register(DOMAIN, SERVICE_EXPORT_EVENTS, _export_events, schema=EXPORT_EVENTS_SCHEMA, supports_response=SupportsResponse.ONLY)


def async_unregister_services(hass: HomeAssistant) -> None:
    if hass.data.get(DOMAIN):
        return  # other config entries (there shouldn't be any) still need them
    for service in (
        SERVICE_ADD_EVENT,
        SERVICE_UPDATE_EVENT,
        SERVICE_DELETE_EVENT,
        SERVICE_IMPORT_EVENTS,
        SERVICE_EXPORT_EVENTS,
    ):
        hass.services.async_remove(DOMAIN, service)
