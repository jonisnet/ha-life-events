# Changelog

All notable changes to Life Events are documented here. Only Beta releases
are cut until noted otherwise.

## 1.0.0-beta.3 — unreleased

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
