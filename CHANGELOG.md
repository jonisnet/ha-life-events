# Changelog

All notable changes to Life Events are documented here. Only Beta releases
are cut until noted otherwise.

## 0.0.1

First real (non-prerelease) release, consolidating everything from
1.0.0-beta.1 through 1.0.0-beta.8 below - the rename from ha-birthdays, the
phone number field, the notification blueprint, the example dashboard, the
logo, several real bugfixes (the Manage card typing bug and its root
causes, a calendar.py thread-safety issue, stale-cache handling), and the
Manage card's search/filter and popup-based editing.

Versioned `0.0.1` rather than `1.0.0` deliberately: development continues
in beta (`0.0.x-beta.N`) until the integration is considered ready for a
real `1.0.0`. A non-prerelease tag exists now specifically so HACS/HA stop
reporting "not on the latest version" against a prerelease tag.

## 1.0.0-beta.8 (folded into 0.0.1 above)

### Added
- The add/edit-person form and the import/export panel now open as a
  **popup** (a self-built modal overlay, not HA's `ha-dialog` - given
  `ha-textfield` doesn't reliably load in this context, betting on
  another such component seemed unwise) instead of inline in the card,
  closable via the header's X, an explicit Annuleren/Sluiten button, or
  clicking outside the popup.
- New **Weergave** (display mode) option on the Manage card, in its
  visual editor: **Volledige kaart** (unchanged - list/search/filters
  always visible) or **Knop die als popup opent** (the card shows just a
  button; the whole management panel - search, filters, list, add,
  import/export - opens as a popup on top of the dashboard).
- On a fresh install with zero events, the add-person popup now opens
  automatically on first load (in button mode, the management panel
  opens too) - skips straight to "add your first event" instead of an
  empty list. Only triggers once; cancelling it doesn't force it back
  open on the next render.

## 1.0.0-beta.7

### Added
- **Life Events: Manage** card: a live search box (filters by name) and a
  month filter, at the top of the card so they stay put while the list
  below scrolls. These filter the runtime list only (independent of the
  card's own `event_types` config option); typing in the search box
  updates the list without losing focus, via a targeted DOM update rather
  than a full re-render.

### Fixed
- `calendar.py`'s dispatcher-connected `_handle_update` was missing the
  `@callback` decorator, so Home Assistant assumed it might be blocking
  and ran it in a worker thread - where `async_write_ha_state()` isn't
  safe to call, producing `RuntimeError: Detected that custom integration
  'life_events' calls async_write_ha_state from a thread other than the
  event loop` every time an event was added/updated/deleted/imported.
  Found via the user's HA logs while debugging the card-loading issue
  below; unrelated to it, but a real stability/data-corruption risk per
  Home Assistant's own warning, so fixed immediately.
- The three card config editors' `Titel`/number fields (e.g. "Aantal
  dagen vooruit") were silently not rendering at all, while the switch
  and checkboxes next to them worked fine. Cause: `ha-textfield` doesn't
  reliably render when loaded from a third-party `extra_module_url`
  script rather than HA's own settings UI (unlike `ha-formfield`/
  `ha-switch`/`ha-checkbox`, which are more broadly available). Replaced
  with a plain, self-styled `<input>` that behaves identically but
  doesn't depend on that component being available.

### Diagnosed, not a code bug
- If the card never appears to update after installing a new version
  despite a full HA restart and the backend log confirming registration
  (`Life Events cards served at ... ?v=<version>`), check whether HA's
  frontend **Service Worker** is serving a stale cached page shell -
  this can survive a normal hard refresh. Test in a fresh incognito
  window; if that works, unregister the service worker and clear site
  data in your normal browser (DevTools -> Application).

## 1.0.0-beta.6

### Fixed
- The real remaining cause of "can't type in the card" reports after
  beta.3/beta.4: that fix only covered the Manage card's own add/edit-event
  form. The three card **config editors** (shown when adding/configuring a
  card from the dashboard UI - `LifeEventsUpcomingCardEditor`,
  `LifeEventsMonthCardEditor`, `LifeEventsManageCardEditor`) had the
  identical bug in `setConfig()`: HA's editor dialog echoes every
  `config-changed` event straight back into a fresh `setConfig()` call,
  which rebuilt the whole form on every keystroke, immediately losing
  focus/selection. Fixed with the same kind of guard, keyed off a flag set
  while we're the one causing the echo (cleared on the next microtask) so
  genuinely external `setConfig()` calls still re-render normally.
  Confirmed unrelated to caching: calling the services directly via
  Developer Tools worked throughout, since that never touches this code
  path.

## 1.0.0-beta.5

### Added
- A logo: a birthday cake with candles growing from small to large (left to
  right), calendar-style "binder rings" above the cake and a row of small
  dots along the base evoking day markers. An original design in HA's brand
  blue (`#18BCF2`) - not HA's own logo mark, which custom integrations are
  explicitly not allowed to use per the
  [brands repo policy](https://github.com/home-assistant/brands#readme).
  Source SVG in `branding/logo.svg`; rasterized to
  `custom_components/life_events/icon.png` (256x256) and `icon@2x.png`
  (512x512), picked up automatically by HA 2026.3.0+'s local custom-
  integration brand icon support (no `home-assistant/brands` PR needed).

## 1.0.0-beta.4

### Fixed
- The bundled card JS was served from a fixed URL (`/life_events_static/
  life-events-cards.js`) that never changed between versions, so browsers
  (and HA's own frontend) could keep serving an old cached copy
  indefinitely after an update - including past a restart, since nothing
  ever told them the file had changed. This meant the beta.3 typing fix
  could silently appear "not to work" for anyone who'd already loaded an
  older copy once. The registered URL now includes `?v=<integration
  version>`, so every version bump forces a fresh fetch. **Requires a full
  Home Assistant restart** (not just "Reload" on the integration) to take
  effect, since the URL is registered once per HA process run.

## 1.0.0-beta.3

### Added
- Import panel on the **Life Events: Manage** card: a file picker to load
  a local `.json`/`.csv` file straight into the import textarea (format
  dropdown auto-selected from the file extension), instead of only being
  able to paste content by hand.
- All three cards' visual editors (the config forms shown when adding/
  editing a card from the dashboard UI) now use HA's own `ha-textfield`/
  `ha-formfield`/`ha-checkbox`/`ha-switch` components with proper spacing,
  instead of bare unstyled `<input>`/`<select>` elements that looked out
  of place next to the rest of the HA UI. The event-type filter is now a
  set of checkboxes instead of a cramped multi-select listbox.

### Fixed
- **Life Events: Manage** card: typing into any field of the add/edit form
  (or pasting into the import textarea) was immediately overwritten,
  making the form unusable. Cause: the card fully re-rendered on every
  `hass` update, which fires on *any* entity's state change anywhere in
  HA (not just this integration's), wiping the in-progress input before
  the next keystroke registered. Fixed by skipping re-render while the
  form or import panel is open.

## 1.0.0-beta.2

### Added
- `phone_number` event field (E.164 format), only meaningful for
  `birthday`/`anniversary` events. The **Life Events: Manage** card exposes
  it as a country dropdown (full ITU dial-code list, defaulting to NL `+31`)
  plus a local-number input, normalized to E.164 client-side (e.g. NL
  `0612345678` → `+31612345678`) before calling the service. Exposed as a
  `phone_number` entity attribute when set, and round-trips through
  CSV/JSON import/export.
- Foundational work for an upcoming automation blueprint that will use this
  field to notify a phone number.
- Automation blueprint `blueprints/automation/jonisnet/notify_todays_events.yaml`:
  runs once a day, finds every `life_events.*` entity happening today for the
  configured event types (no separate helper sensor needed), and runs a
  user-supplied notification action per person with `person_name`,
  `phone_number` (E.164) and `phone_number_wa` (E.164 without the leading
  `+`, ready for a `https://wa.me/` link) available as variables. Optionally
  adds a to-do item per event. Modeled on a real WhatsApp-notification +
  to-do automation already in use.
- Example dashboard `dashboards/life_events.yaml`: Upcoming + Month overview
  side by side, Manage below.

## 1.0.0-beta.1

Renamed from `ha-birthdays` (domain `birthdays`) to `ha-life-events` (domain
`life_events`), on top of that project's full rearchitecture from a
YAML-only integration into a config-entry integration. Version reset to
1.0.0 for this fresh start; see [ha-birthdays](https://github.com/jonisnet/ha-birthdays)
(now archived) for the 2.0.0-beta.1 history this was renamed from, and
[Miicroo/ha-birthdays](https://github.com/Miicroo/ha-birthdays) for the
original upstream project (1.3.0 and earlier).

### Changed
- Domain renamed `birthdays` → `life_events`; entities now live under
  `life_events.*` instead of `birthdays.*`.
- Display name "Birthdays" → "Life Events" throughout (config flow, cards,
  HACS listing).
- Bundled cards renamed: `birthdays-upcoming-card` → `life-events-upcoming-card`,
  `birthdays-month-card` → `life-events-month-card`, `birthdays-manage-card` →
  `life-events-manage-card`. Card JS asset renamed to `life-events-cards.js`,
  served from `/life_events_static/` instead of `/birthdays_static/`.
- Services renamed to the `life_events.*` domain (`add_event`, `update_event`,
  `delete_event`, `import_events`, `export_events`).

### Kept for backwards compatibility
- The legacy `birthdays:` YAML key (from the original pre-2.0 integration) is
  still auto-detected and imported once on first setup — matched by that
  fixed key regardless of the new domain name, so upgraders coming straight
  from the old YAML-only setup are unaffected by the rename.
- The HA bus event fired on every occurrence is still named `birthday`
  (not renamed to match the domain), and every entity still exposes a
  `date_of_birth` attribute regardless of `event_type`, so existing
  automations/dashboards/templates keep working unmodified.

### Not yet migrated
- No automatic migration path yet from `ha-birthdays` v2.0.0-beta.1's
  config-entry storage (as opposed to the older flat YAML format, which is
  still supported). Re-enter events manually or via export/import for now.

## Inherited from ha-birthdays v2.0.0-beta.1

- Config-entry based setup (Settings → Devices & services → Add integration),
  backed by Home Assistant Storage instead of `configuration.yaml`.
- Automatic one-time import of a legacy `birthdays:` YAML config into storage
  on first setup, preserving existing entity_ids.
- `event_type` concept: `birthday`, `anniversary`, `deceased`. Legacy YAML
  entries are heuristically classified (name/unique_id containing
  "trouwdag"/"jubileum"/"anniversary" → anniversary, everything else →
  birthday).
- `date_of_death` field for `deceased` events.
- Three bundled Lovelace cards with visual editors, auto-registered as a
  frontend resource, no separate HACS plugin install step needed.
- Templated attributes (Jinja templates as attribute values in YAML config)
  are no longer supported, same as in that release.

## 1.3.0 and earlier

See the original upstream project:
https://github.com/Miicroo/ha-birthdays
