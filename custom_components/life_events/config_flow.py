"""Config flow for Life Events. Single instance, no user input required."""
from __future__ import annotations

from homeassistant import config_entries
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN, DOMAIN_FRIENDLY_NAME


class LifeEventsConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> FlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(title=DOMAIN_FRIENDLY_NAME, data={})

        return self.async_show_form(step_id="user")

    async def async_step_import(self, import_config: dict) -> FlowResult:
        """Triggered automatically when a legacy `birthdays:` YAML config is found."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        return self.async_create_entry(title=DOMAIN_FRIENDLY_NAME, data={})
