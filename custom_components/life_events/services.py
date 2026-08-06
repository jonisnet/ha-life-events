"""Services: add/update/delete/import/export events, callable from the cards."""
from __future__ import annotations

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall, ServiceResponse, SupportsResponse
import homeassistant.helpers.config_validation as cv

from .const import (
    CONF_FIXED_ATTR_KEY,
    CONF_FIXED_ATTR_OPTIONS,
    CONF_FIXED_ATTRIBUTES,
    DOMAIN,
    EVENT_TYPES,
    FORMAT_CSV,
    FORMAT_JSON,
    IMPORT_MODE_MERGE,
    IMPORT_MODE_REPLACE,
    RELATIONSHIP_TYPE_MARRIED,
    RELATIONSHIP_TYPES,
    SERVICE_ADD_EVENT,
    SERVICE_DELETE_EVENT,
    SERVICE_EXPORT_EVENTS,
    SERVICE_GET_FIXED_ATTRIBUTES,
    SERVICE_IMPORT_EVENTS,
    SERVICE_LINK_MARRIAGE,
    SERVICE_SET_FIXED_ATTRIBUTES,
    SERVICE_UNLINK_MARRIAGE,
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
        vol.Optional("phone_number"): cv.string,
        vol.Optional("time"): cv.string,
        vol.Optional("parent_ids", default=[]): vol.All(cv.ensure_list, [cv.string], vol.Length(max=2)),
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
        vol.Optional("phone_number"): cv.string,
        vol.Optional("time"): cv.string,
        vol.Optional("parent_ids"): vol.All(cv.ensure_list, [cv.string], vol.Length(max=2)),
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

FIXED_ATTRIBUTE_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_FIXED_ATTR_KEY): cv.string,
        vol.Optional(CONF_FIXED_ATTR_OPTIONS): [cv.string],
    }
)

SET_FIXED_ATTRIBUTES_SCHEMA = vol.Schema(
    {vol.Required(CONF_FIXED_ATTRIBUTES): [FIXED_ATTRIBUTE_SCHEMA]}
)

LINK_MARRIAGE_SCHEMA = vol.Schema(
    {
        vol.Required("event_id"): cv.string,
        vol.Required("spouse_id"): cv.string,
        # Optional: the exact date isn't always known (e.g. for a couple
        # who were already married before this integration existed) - the
        # link can still be recorded, just without an anniversary occasion
        # until the date is filled in later via a plain update.
        vol.Optional("marriage_date"): cv.date,
        vol.Optional("relationship_type", default=RELATIONSHIP_TYPE_MARRIED): vol.In(RELATIONSHIP_TYPES),
    }
)

UNLINK_MARRIAGE_SCHEMA = vol.Schema({vol.Required("event_id"): cv.string})


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

    async def _set_fixed_attributes(call: ServiceCall) -> None:
        manager = _manager_for_call(hass, call)
        await manager.async_set_fixed_attributes(call.data[CONF_FIXED_ATTRIBUTES])

    async def _get_fixed_attributes(call: ServiceCall) -> ServiceResponse:
        manager = _manager_for_call(hass, call)
        return {CONF_FIXED_ATTRIBUTES: manager.fixed_attributes}

    async def _link_marriage(call: ServiceCall) -> None:
        manager = _manager_for_call(hass, call)
        await manager.async_link_marriage(
            call.data["event_id"], call.data["spouse_id"], call.data.get("marriage_date"), call.data["relationship_type"]
        )

    async def _unlink_marriage(call: ServiceCall) -> None:
        manager = _manager_for_call(hass, call)
        await manager.async_unlink_marriage(call.data["event_id"])

    hass.services.async_register(DOMAIN, SERVICE_ADD_EVENT, _add_event, schema=ADD_EVENT_SCHEMA, supports_response=SupportsResponse.OPTIONAL)
    hass.services.async_register(DOMAIN, SERVICE_UPDATE_EVENT, _update_event, schema=UPDATE_EVENT_SCHEMA, supports_response=SupportsResponse.OPTIONAL)
    hass.services.async_register(DOMAIN, SERVICE_DELETE_EVENT, _delete_event, schema=DELETE_EVENT_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_IMPORT_EVENTS, _import_events, schema=IMPORT_EVENTS_SCHEMA, supports_response=SupportsResponse.OPTIONAL)
    hass.services.async_register(DOMAIN, SERVICE_EXPORT_EVENTS, _export_events, schema=EXPORT_EVENTS_SCHEMA, supports_response=SupportsResponse.ONLY)
    hass.services.async_register(DOMAIN, SERVICE_SET_FIXED_ATTRIBUTES, _set_fixed_attributes, schema=SET_FIXED_ATTRIBUTES_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_GET_FIXED_ATTRIBUTES, _get_fixed_attributes, schema=vol.Schema({}), supports_response=SupportsResponse.ONLY)
    hass.services.async_register(DOMAIN, SERVICE_LINK_MARRIAGE, _link_marriage, schema=LINK_MARRIAGE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_UNLINK_MARRIAGE, _unlink_marriage, schema=UNLINK_MARRIAGE_SCHEMA)


def async_unregister_services(hass: HomeAssistant) -> None:
    if hass.data.get(DOMAIN):
        return  # other config entries (there shouldn't be any) still need them
    for service in (
        SERVICE_ADD_EVENT,
        SERVICE_UPDATE_EVENT,
        SERVICE_DELETE_EVENT,
        SERVICE_IMPORT_EVENTS,
        SERVICE_EXPORT_EVENTS,
        SERVICE_SET_FIXED_ATTRIBUTES,
        SERVICE_GET_FIXED_ATTRIBUTES,
        SERVICE_LINK_MARRIAGE,
        SERVICE_UNLINK_MARRIAGE,
    ):
        hass.services.async_remove(DOMAIN, service)
