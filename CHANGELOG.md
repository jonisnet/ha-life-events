# Changelog

All notable changes to Life Events are documented here. Only Beta releases
are cut until noted otherwise.

## 0.0.2-beta.11 — unreleased

### Added
- **Automatic language detection for both the integration and the cards.**
  Everything now follows `hass.language` (your Home Assistant profile
  language) with no setting to configure - no more Dutch-only UI. Shipped
  languages: Dutch, English, German, French; anything unsupported falls
  back to English, then Dutch. The cards' text lives in
  `custom_components/life_events/www/translations/*.json`, one small JSON
  file per language, loaded lazily the first time a language is needed
  (Dutch is inlined in the script itself, so it always works with zero
  network requests even if the translation files can't be fetched for some
  reason). Adding a new language is just copying `en.json`, translating the
  values, and adding the language code to `SUPPORTED_LANGS` near the top
  of `life-events-cards.js` - no other code changes, so the community can
  contribute a translation directly. The integration's own config-flow and
  service name/description strings follow HA's normal
  `translations/*.json` convention the same way. Not yet translated (out
  of scope for this pass, tracked for later): the phone-number field's
  country-name dropdown, and the cards' pre-configured default titles.
  Verified with a dedicated 7-check runtime test covering language
  auto-detection, base-language extraction from region variants (e.g.
  `de-AT` → `de`), graceful fallback when a translation file can't be
  fetched, and the zero-network-request Dutch default - plus the full
  existing regression suite (91 checks, all still passing; the refactor
  touched nearly every render function but changed no behavior for the
  default Dutch case).

## 0.0.2-beta.10

### Fixed
- Selecting text inside the edit popup (e.g. click-drag or double-click to
  select a word in a field) could close the whole popup mid-selection.
  Root cause: `bindModalBackdrops()`'s click-outside-to-close only checked
  where the `click` event's target landed - if a text-selection drag
  started inside the modal but the mouseup ended up over the backdrop's
  padding, the browser still reports that as a click on the backdrop,
  which was indistinguishable from a genuine click-outside. Fixed by also
  requiring the preceding `mousedown` to have landed on the backdrop
  itself before treating a `click` as click-outside - a selection drag
  starting inside the modal no longer counts, but a real click-outside
  (mousedown + click both on the backdrop) still closes/cancels exactly
  as before. Verified with a new 4-check runtime test
  (`logo-drafts/modal-text-selection-test.html`) plus the full existing
  regression suite (91 checks total, all still passing).

## 0.0.2-beta.9

### Added
- All three cards can now be made **collapsible** (checkbox in the visual
  editor, off by default): a chevron arrow appears in the card header to
  fold/unfold the body. Non-collapsible cards are completely unchanged
  (still use the native `ha-card header="..."`); opting in swaps to a
  custom header just for that card so the arrow has somewhere to live.
- The **Month card's table headers** (Datum, Naam, Type, Leeftijd) are now
  clickable to sort: each click cycles A-Z → Z-A → uit (Naam/Type),
  1-150 → 150-1 → uit (Leeftijd), or eerste → laatste → uit (Datum). Up to
  **2 columns** can be active at once (shown as a small priority number
  when both are); activating a 3rd evicts the oldest. With nothing
  clicked, falls back to the previous default (ascending by day). Ages
  without a value (deceased events) always sort last regardless of
  direction.

Verified with a dedicated 21-check runtime browser test
(`logo-drafts/collapsible-and-sort-test.html`), plus the full existing
66-check regression suite across all other test harnesses.

## 0.0.2-beta.8

### Fixed
- **Important:** the Upcoming and Month cards' new "Bewerken" edit popup
  (0.0.2-beta.6) had the same "typing gets silently wiped" bug the Manage
  card had before - `hass` updates fire on *any* entity's state change
  anywhere in HA, and the base card class blindly re-rendered on every
  one, wiping in-progress typing in the edit form. Fixed structurally this
  time instead of per-card: `LifeEventsBaseCard.set hass()` now detects an
  open modal by checking the actual rendered DOM (`.bd-modal-backdrop`)
  rather than relying on each card to remember to set a `_suppressRender`
  flag - which is exactly how this bug reappeared, since nobody added
  that flag when the Upcoming/Month cards gained their own popup. Any
  future popup that uses `modalWrap()` is now safe by construction, with
  nothing to remember. A prominent comment at the top of
  `life-events-cards.js` documents this for future additions, and
  `logo-drafts/hass-tick-suppression-test.html` is a reusable regression-
  test pattern for any new stateful UI. Verified across all 6 existing
  runtime test suites (66 checks total, all still passing) plus a new
  9-check suite that specifically simulates unrelated hass ticks while
  mid-edit on both the Upcoming and Month cards.

## 0.0.2-beta.7

### Added
- Optional **`time`** field (e.g. a birth time) alongside the existing
  date, for all event types. Purely informational - never required, no
  calculation depends on it. Rarely known for existing entries, but often
  printed on a birth announcement card for a newborn, so worth capturing
  going forward. Editable in the Manage card's form (and now the
  Upcoming/Month cards' edit popup too), shown in the details popup when
  set, and round-trips through the `add_event`/`update_event` services and
  CSV/JSON import-export.

## 0.0.2-beta.6

### Added
- The Upcoming and Month cards' read-only details popup now has a
  **"Bewerken"** button that switches the same popup into the full edit
  form (name, date, phone, custom attributes, delete) - previously only
  the Manage card could edit. Shares the exact same form/save/delete logic
  as the Manage card (extracted into shared functions, no duplication);
  "Annuleren" while editing goes back to the read-only view rather than
  closing the popup.

### Changed
- Polished the details popup: zebra-striped rows, bolder values, an event
  icon next to the title, and a highlighted modal header.

## 0.0.2-beta.5

### Added
- Every entity (event entities and the calendar) now automatically carries
  a "Life Events" **label**. Since event entities deliberately don't share
  a device anymore (0.0.2-beta.4), this is how you can still find/filter
  every entity belonging to this integration in one place, via Settings →
  Areas, labels & zones → Labels. Applied once per entity on setup;
  doesn't touch any other labels you've added yourself.

### Changed
- Deleting an event in the Manage card's edit popup no longer uses the
  browser's native `confirm()` dialog (looked out of place, unstyled, in
  the Companion app/kiosk dashboards). Clicking "Verwijderen" now shows an
  inline "Weet je het zeker?" step with "Ja, verwijderen"/"Annuleren"
  buttons, styled like the rest of the card.

## 0.0.2-beta.4

### Fixed
- **Important:** the "Life Events {naam}" prefix on every person's
  friendly_name (reported after the device-grouping fix started actually
  working) was NOT fixed by the `_attr_has_entity_name = False` change
  shipped in 0.0.2-beta.2, and setting that explicitly never had a chance
  to work. Root cause, found by reading the actual HA 2026.7.4 source (the
  version the report came from) rather than the older 2024.6.0b6 this repo's
  CI happens to pin: HA's "legacy naming" friendly-name computation
  (`homeassistant/helpers/entity_registry.py::_async_get_full_entity_name`,
  used whenever `entry.name` has no manual override) always joins
  `device name + entity name` for any entity linked to a device -
  `has_entity_name` only affects whether HA *tries* to strip a
  redundant/already-matching prefix from the raw name, not whether the
  device name gets added in the first place. Sharing one "Life Events"
  device across every person entity was only ever a visual nicety on top
  of the actual fix (being tied to the config entry via `EntityComponent`,
  which is what makes entities show up under Settings → Devices & services
  at all) - not worth this side effect for 100+ entities. `EventEntity` no
  longer declares `device_info`; the calendar entity keeps its own device
  since it's a single, uniquely-named entity that displays cleanly either
  way.

## 0.0.2-beta.3

### Added
- The Upcoming card's top row now shows a live, ticking countdown to the
  next event ("Nog X dagen Y uur Z min W sec"), updated every second
  without a full card re-render. Computed client-side from the stored
  month/day (the backend only ever exposed a whole-day count), mirroring
  `calendar.py`'s own next-occurrence rollover logic so "today is the day"
  correctly shows "Vandaag!" immediately instead of a ~365-day countdown
  to next year (a rollover bug caught by the runtime browser test before
  shipping, not by eye).

## 0.0.2-beta.2

### Fixed
- Entity `friendly_name` was showing the device name prefixed onto every
  person's name ("Life Events Jazlyn Propitius") once the entity/device
  grouping fix (0.0.2-beta.1) actually started working for real -
  `EventEntity` never explicitly set `_attr_has_entity_name = False` the
  way `calendar.py` already did, so it inherited whatever the base
  `Entity` class defaults to. Set it explicitly.

### Added
- The Manage card's add/edit popup now has separate **Voornaam**/
  **Achternaam** fields instead of one **Naam** field. Still stored and
  used everywhere else as a single combined name (entity naming, search,
  CSV/JSON export, ...) - only the input/edit form is split, so changing
  just a surname (e.g. after marriage) no longer means retyping the whole
  name. When editing an existing entry, the combined name is split back on
  its first space (voornaam = first word, achternaam = the rest, including
  Dutch tussenvoegsels like "van der").
- Every card row is now clickable. In the Upcoming and Month cards, this
  opens a read-only "details" popup showing every attribute (date, type,
  age, phone number, custom attributes, ...). In the Manage card, it opens
  the existing edit popup directly - the pencil-icon (✏️) button is gone,
  since the whole row is the trigger now.
- The Manage card's list is empty by default, with a message asking you to
  pick a filter first, rather than dumping the entire list. Alongside the
  existing search-by-name and month filters, added a **Geslacht**
  (man/vrouw/anders) filter and a generic attribute filter: pick any
  custom attribute key actually in use (e.g. `connectie`), then a value
  seen for it - adapts automatically to whatever attributes you've
  defined, no hardcoded schema.

## 0.0.2-beta.1

### Fixed
- **Important:** the device/entity-grouping fix first attempted earlier in
  this line could never actually have worked. It forwarded `DOMAIN` itself
  (`life_events`) via `hass.config_entries.async_forward_entry_setups(entry,
  [DOMAIN, ...])`, but HA core's `ConfigEntry.async_setup()` treats "forward to a
  platform whose domain equals the integration's own domain" as
  re-entering that same entry's setup (its `domain_is_integration` check),
  which always raises `OperationNotAllowed` since that call happens from
  inside the entry's own `async_setup_entry`. This was masked for three
  betas by the CI failures fixed just above - once those were cleared,
  `tests/test_init.py` immediately caught it failing for real against
  actual HA core. Fixed by using `EntityComponent.async_setup_entry()` /
  `.async_unload_entry()` in `__init__.py` instead of forwarding through
  `hass.config_entries` for the `life_events` domain - the actual
  HA-supported mechanism for entities that live directly under their own
  integration's domain, which still produces a config-entry-bound
  `EntityPlatform` (so device/entity registry linkage works) without
  hitting the reentrancy guard. `Platform.CALENDAR` still forwards
  normally, since "calendar" isn't the integration's own domain. This also
  caught a second, smaller mistake in `tests/test_init.py` itself: it
  asserted entity registry entries disappear on `async_unload`, but that's
  not real HA behavior - unloading only removes entity *state*, registry
  entries (entity_id, area, customizations) deliberately survive until the
  entry is fully *removed*. And that fix exposed a third: unload doesn't
  delete entity *state* either - `Entity.async_remove()` defaults to
  `force_remove=False`, which marks the state `unavailable` rather than
  deleting it, again so a quick reload doesn't lose the last-known state.
  Test now checks `hass.states.get(...).state == "unavailable"`, renamed
  to `test_unload_entry_marks_entities_unavailable`.
- The Manage card's search box and month filter had the same "wipes on
  interaction" bug as the earlier typing fixes, just in a spot those fixes
  didn't cover: they live inline in the always-visible panel body, not
  inside a modal, so `_suppressRender` (which only guards the modal-open
  states) never protected them from a full re-render on every incoming
  `hass` tick. Fixed by overriding `get hass()`/`set hass()` directly on
  `LifeEventsManageCard`: after the first render, ordinary `hass` ticks now
  go through the existing targeted `_renderList()` (which only touches
  `#le-list`) instead of a full `_render()`, unless a modal actually is
  open.
- CI for `tests/test_init.py` (added in 0.0.2-beta.1 for the device/entity
  grouping fix) kept failing even after making the test file's own
  fixture `async def`. The real cause: `pytest-homeassistant-custom-component`
  ships its own async `enable_custom_integrations`/`hass` fixtures, and
  pytest-asyncio only awaits async fixtures automatically under
  `asyncio_mode = auto` - this repo's `setup.cfg` never set it, so under
  the default strict mode those fixtures landed un-awaited
  (`AttributeError: 'async_generator' object has no attribute 'data'`).
  Added `asyncio_mode = auto` under `[tool:pytest]`. That fix then exposed
  a second, real gap: the bare `hass` test fixture doesn't set up the
  `http`/`frontend` components the way a real HA instance always does
  before custom integrations get set up, so `_async_register_frontend()`
  (which needs `hass.http` and touches `frontend`'s internal extra-JS-URL
  registry) failed - and fully setting up `frontend` itself isn't viable in
  a test environment, since it pulls in the separate `hass_frontend`
  static-assets package. Since frontend resource registration isn't what
  these tests are actually about (they check entity/device registry
  linkage), fixed by mocking out `_async_register_frontend` entirely in the
  test helper instead of dragging in unrelated, heavy setup.

### Added
- The Manage card's add/edit popup now has a "Aangepaste attributen" editor:
  freeform key/value rows you define yourself (e.g. `relatie`, `geslacht`),
  add/remove per event. This existed in the original ha-birthdays as a
  generic `attributes` dict, and the backend here (models.py, entity.py,
  services.py, store.py's CSV/JSON import-export) already carried it
  through unchanged since the rename - it just had no UI, so it was only
  reachable via Developer Tools → Services. Saved custom attributes now
  also show in the Manage card's list rows, not only inside the popup.

### Changed
- The 🗑️ delete button no longer sits in the Manage card's list rows -
  it's now inside the edit popup only, next to Opslaan/Annuleren, so
  deleting requires opening an item first.

## 0.0.2-beta.1

### Fixed
- The logo added in 0.0.1 never actually showed up anywhere in HA
  ("icon not available" placeholder). The local-icon support it was based
  on (home-assistant/core#161027) turned out to be superseded before it
  shipped by a dedicated `brands` component with a different, token-gated
  API and a stricter local-file convention: icons must live in a `brand/`
  subfolder (`custom_components/life_events/brand/icon.png`), gated by
  `Integration.has_branding` (`"brand" in top_level_files`) - not the
  integration's root folder. Verified this time against the actual
  current `homeassistant/components/brands/__init__.py` source rather
  than an outdated PR description. Moved `icon.png`/`icon@2x.png` into
  `brand/` accordingly.

- Event entities (`life_events.*`) weren't tied to the config entry's
  device registry the way the calendar entity was, so **Settings →
  Devices & services → Life Events** only listed 1 item even though the
  page header correctly showed the full entity count. Root cause:
  `manager.py` added them through a bare `EntityComponent(DOMAIN, hass)`,
  whose `EntityComponent.__init__` binds to a platform with
  `config_entry=None` - unlike `calendar.py`'s entity, which goes through
  the standard `async_forward_entry_setups` path and *was* properly
  linked. Fixed by forwarding `DOMAIN` itself as a platform too (new
  `life_events.py`, following the same pattern real HA core integrations
  use for entities that live directly under their own domain), so
  `manager.py` now receives a real config-entry-bound `async_add_entities`
  callback instead of using a disconnected `EntityComponent`. Both the
  calendar and every event entity now declare the same `device_info`, so
  they group into one shared "Life Events" device. This only changes
  *how* entities are registered internally - entity_ids, unique_ids, and
  stored data are untouched, so existing entity history/automations are
  unaffected. Added `tests/test_init.py` (needs the real `homeassistant`
  package, so only runs in CI) asserting entities are actually tied to
  the config entry and share one device, and that unloading the entry
  removes them all - since this specific class of bug is easy to silently
  reintroduce and hard to catch by eye.

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
