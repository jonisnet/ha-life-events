# Life Events

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
| `date_of_death` | no | Only meaningful for `deceased` |
| `icon` | no | Defaults per event type (`mdi:cake`, `mdi:ring`, `mdi:flower`) |
| `phone_number` | no | E.164 format (e.g. `+31612345678`). Only meaningful for `birthday`/`anniversary`. The **Life Events: Manage** card lets you pick a country from the full dial-code list and type the local number (e.g. NL `0612345678`) — it's normalized to E.164 for you. |
| `attributes` | no | Freeform key/value pairs, exposed as extra entity attributes |

## Services

- `life_events.add_event`
- `life_events.update_event`
- `life_events.delete_event`
- `life_events.import_events` (`format: csv|json`, `mode: merge|replace`)
- `life_events.export_events` (`format: csv|json`, returns the content)

These are what the bundled cards call under the hood — you can also use them
directly in automations/scripts.

## Lovelace cards

The integration serves its cards itself; they're auto-registered as a
frontend resource. If your dashboard doesn't pick them up automatically,
add `/life_events_static/life-events-cards.js` as a Lovelace resource
(**Settings → Dashboards → ⋮ → Resources**, type: JavaScript module).

- **Life Events: Upcoming** (`life-events-upcoming-card`) — list of events in
  the next N days.
- **Life Events: Month overview** (`life-events-month-card`) — month picker +
  table, the same layout as the original hand-built dashboard.
- **Life Events: Manage** (`life-events-manage-card`) — add/edit/delete events,
  plus import/export.

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
runs your own notification action per person — no separate helper sensor
needed. Available variables in your notification action: `person_name`,
`entity_id`, `event_type`, `age`, `phone_number` (E.164), `phone_number_wa`
(same number without the leading `+`, e.g. for a `https://wa.me/` link).
It can also add a to-do item per event, if you configure a to-do list.

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
