<p align="center"><img src="custom_components/life_events/brand/icon.png" width="96" height="96" alt="Life Events logo: a birthday cake with candles growing from small to large, left to right"></p>

# Life Events

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?style=flat-square&logo=buy-me-a-coffee&logoColor=black)](https://www.buymeacoffee.com/jonisnet)

> **⚠️ Beta.** This project is a rename/continuation of [ha-birthdays](https://github.com/jonisnet/ha-birthdays)
> (itself a fork of [Miicroo/ha-birthdays](https://github.com/Miicroo/ha-birthdays)), starting fresh at
> **v1.0.0-beta.1**. Only Beta versions are released while this settles — see [CHANGELOG.md](CHANGELOG.md).

Track birthdays, anniversaries, and (optionally) deceased loved ones. Every
event can be added, edited, deleted, imported and exported entirely from the
Home Assistant interface, and the integration ships its own Lovelace cards.

## Why the rename

The integration outgrew its old name: it tracks three kinds of events
(birthday, anniversary, deceased), not just birthdays, so "Life Events" fits
better. The domain also changed, from `birthdays` to `life_events` — see
**Migrating** below for what that means for existing installs.

## Installation

### HACS (recommended)

1. Go to integrations
2. Press the dotted menu in the top right corner
3. Choose custom repositories
4. Add the URL to this repository
5. Choose category `Integration`
6. Click add

### Manual

1. Copy `custom_components/life_events` into your HA config's `custom_components` directory.
2. Restart Home Assistant.
3. Go to **Settings → Devices & services → Add integration** and search for **Life Events**.

The icon shown above is bundled directly in the integration's `brand/`
subfolder (`custom_components/life_events/brand/icon.png`) and picked up
automatically by Home Assistant's `brands` component (2026.3.0 and later).
On older versions you'll just see a generic/placeholder icon in the
integrations list — everything else still works.

## Migrating

### From the legacy YAML-only version (pre-2.0, domain `birthdays`)

If you have an existing `birthdays:` section in `configuration.yaml` (including
split files loaded via `!include_dir_merge_list`), nothing needs to change
before upgrading. On first start after installing Life Events:

1. Add the integration once via the UI (**Settings → Devices & services**).
2. All entries from your YAML config are imported into storage, keeping their
   original `entity_id`s (now under the `life_events.*` domain instead of
   `birthdays.*`).
3. You can now safely remove the `birthdays:` key from `configuration.yaml` —
   it's only read during that one-time import, leaving it in place afterwards
   is harmless too, it's simply not re-read.
4. Because the legacy format has no explicit "this is an anniversary" field,
   entries are heuristically classified: anything with "trouwdag", "jubileum"
   or "anniversary" in its name/unique_id becomes an `anniversary`, everything
   else becomes a `birthday`. Open the **Life Events: Manage** card and correct
   any entry that was classified wrong, or set it to `deceased` and fill in a
   date of death.

### From ha-birthdays v2.0.0-beta.1 (config-entry storage, domain `birthdays`)

There is no automatic migration from that intermediate config-entry-based
storage yet — only the original flat YAML format above is auto-imported. If
you already moved to that beta, re-enter your events via **Life Events: Manage**
or the `life_events.import_events` service (export from the old integration
first with `birthdays.export_events`, then import here).

Every event still exposes a `date_of_birth` attribute regardless of its
`event_type` (even anniversaries) — this is intentional, so templates and
dashboards written against the original integration keep working unmodified.

## Event fields

| Field | Required | Notes |
|---|---|---|
| `name` | yes | |
| `date` | yes | Reference date (birth date, wedding date, ...) |
| `event_type` | no, default `birthday` | `birthday`, `anniversary` or `deceased` |
| `date_of_death` | no | Only meaningful for `deceased`. When set, the cards show a computed, tasteful "X jaar geleden overleden" ("X years ago") instead of leaving the age blank - the underlying `years_since_death` entity attribute ticks over on the anniversary itself, same as a birthday's age. |
| `icon` | no | Defaults per event type (`mdi:cake`, `mdi:ring`, `mdi:flower`) |
| `phone_number` | no | E.164 format (e.g. `+31612345678`). Only meaningful for `birthday`/`anniversary`. The **Life Events: Manage** card lets you pick a country from the full dial-code list and type the local number (e.g. NL `0612345678`) — it's normalized to E.164 for you. |
| `time` | no | Time of day (e.g. a birth time), purely informational - not used in any calculation. Rarely known for existing entries, but often printed on a birth announcement card for a newborn. |
| `attributes` | no | Freeform key/value pairs you define yourself (e.g. `relatie`, `geslacht`), exposed as extra entity attributes. Editable directly in the **Life Events: Manage** card's add/edit popup — add or remove as many as you like, no fixed schema. |

### Fixed (required) attributes

Some attributes should always be filled in, for everyone — e.g. a `geslacht`
field with fixed options `man`/`vrouw`/`anders`. Define these once, for the
whole install, in the **Life Events: Manage** card's visual editor: give it
a name, choose free text or a dropdown (comma-separated options), and save.
It then shows up as a required field on **every** card's add/edit form (not
just the Manage card), and `add_event`/`update_event` reject the call
server-side if it's missing — so this is enforced for automations/scripts
too, not just the cards. Not hardcoded into the integration, so it's opt-in
per install.

## Services

- `life_events.add_event`
- `life_events.update_event`
- `life_events.delete_event`
- `life_events.import_events` (`format: csv|json`, `mode: merge|replace`)
- `life_events.export_events` (`format: csv|json`, returns the content)
- `life_events.set_fixed_attributes` / `life_events.get_fixed_attributes` —
  normally only called by the Manage card's editor, not directly.

These are what the bundled cards call under the hood — you can also use them
directly in automations/scripts.

## Lovelace cards

The integration serves its cards itself; they're auto-registered as a
frontend resource. If your dashboard doesn't pick them up automatically,
add `/life_events_static/life-events-cards.js` as a Lovelace resource
(**Settings → Dashboards → ⋮ → Resources**, type: JavaScript module).

**After updating and restarting HA, the cards still look/behave like an
older version?** Check the HA log for a line containing `cards served at`
(**Settings → System → Logs**, search `life_events`) — if it shows the
current `?v=<version>`, the backend is registering the right file and the
problem is your browser's cache. First try an incognito/private window; if
that's fixed, your normal browser's frontend **Service Worker** is likely
serving a stale cached page shell (this can survive a normal hard refresh).
Fix it via DevTools → Application → Service Workers → Unregister, then
Application → Storage → Clear site data.

- **Life Events: Upcoming** (`life-events-upcoming-card`) — list of events in
  the next N days.
- **Life Events: Month overview** (`life-events-month-card`) — month picker +
  table, the same layout as the original hand-built dashboard.
- **Life Events: Manage** (`life-events-manage-card`) — search/filter, add,
  edit, delete, import/export events. Adding/editing opens as a popup.
  Has a `display_mode` option (set in the card's visual editor, under
  **Display**/**Weergave**): `full` (default) keeps the list/search always
  visible, or `button` shows just a button that opens the whole panel as a
  popup.
  On a fresh install with no events yet, the add-event popup opens
  automatically.

Add them via the dashboard UI card picker (search "Life Events"), or in YAML:

```yaml
- type: custom:life-events-upcoming-card
  title: Aankomende verjaardagen
  days_ahead: 14

- type: custom:life-events-month-card
  title: Verjaardagen per maand
  columns: 3

- type: custom:life-events-manage-card
  title: Verjaardagen beheren
```

Every card supports an `event_types` list to only show birthdays,
anniversaries, deceased, or any combination — configurable from each card's
visual editor.

## Language

Both the integration (config flow, service names) and the cards auto-detect
your Home Assistant language (`hass.language`) — no setting to configure.
Currently shipped: Dutch, English, German, French; anything else falls back
to English, then Dutch.

Card text lives in `custom_components/life_events/www/translations/*.json`
(one small JSON file per language, just key → text). Contributing a new
language is just copying `en.json`, translating the values, and adding the
language code to `SUPPORTED_LANGS` near the top of
`life-events-cards.js` — no other code changes needed. The integration's own
strings (config flow, service names) follow HA's normal
`translations/*.json` convention in the same way.

Not yet translated: the phone-number field's country-name dropdown (still
Dutch-only) and the cards' default titles shown before you've set your own
(e.g. when first dragging a card onto a dashboard).

## Automation

All events are updated at midnight, and when an event occurs, an event is
sent on the HA bus (event type `birthday` — kept as-is for backwards
compatibility with existing automations, even for anniversaries/deceased)
with `name`, `age`, `event_type` and `deceased`.

```yaml
automation:
  trigger:
    platform: event
    event_type: "birthday"
    action:
      service: notify.pushbullet
      data_template:
        title: "Birthday!"
        message: "{{ trigger.event.data.name }} turns {{ trigger.event.data.age }} today!"
```

### Blueprint

`blueprints/automation/jonisnet/notify_todays_events.yaml` runs once a day,
finds every event happening that day (for the event types you pick), and
sends a ready-made notification for each one — no separate helper sensor
needed, and nothing to build yourself. The only thing you configure is
which device(s) (running the Companion App) should receive it; title,
message, and (when available) a "WhatsApp {name}" action button are all
built automatically, using the newer relationship-type, couple's-
anniversary, and primary-contact-delegation data - so a child's
notification WhatsApps their parent instead, if that's how it's set up.
Tapping the notification itself opens WhatsApp too (falling back to the
Life Events overview if no number is known), and a second button always
jumps to that overview directly. A deceased person's actual remembrance
day (not just their would-be birthday) is included too. It can also add a
to-do item per event, and an optional extra action (with all the same
data available as variables) for anything further you want to layer on
top.

Import it via **Settings → Automations → ⋮ → Import blueprint**, pasting:

```
https://raw.githubusercontent.com/jonisnet/ha-life-events/master/blueprints/automation/jonisnet/notify_todays_events.yaml
```

## Example dashboard

`dashboards/life_events.yaml` combines the three bundled cards into a single
ready-made view: Upcoming (30 days) and Month overview side by side, with
Manage below.

To use it: **Settings → Dashboards → + Add dashboard → New dashboard from
scratch**, then open its **⋮ → Edit in YAML** and paste the contents of that
file (or copy just the `cards:` block into an existing view).
