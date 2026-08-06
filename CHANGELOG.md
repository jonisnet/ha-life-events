# Changelog

All notable changes to Life Events are documented here. Development happens
in beta releases (`0.0.x-beta.N`) between occasional real releases, where
this file is consolidated into one summary per real version.

## 0.0.4-beta.5

### Added
- **Primary contact delegation**: a person can now designate their linked
  spouse/partner or a linked parent as their "primary contact" instead of
  their own number - meant for a child who has their own phone number but
  isn't who a household automation should actually message. Pick one via a
  small row of buttons ("Zelf" plus each linked candidate) on the edit
  form. Every person's entity now also exposes `primary_phone_number` /
  `primary_contact_name` (resolving to the delegate if one is set and
  valid, otherwise the person's own number - always populated when any
  number is known, no delegation required) and a ready-made
  `primary_whatsapp_link` (`https://wa.me/...`) for building a WhatsApp
  deep-link straight from an automation. If a delegation later becomes
  stale (the spouse link ends, the parent is unlinked or removed), it's
  silently ignored and resolution falls back to the person's own number -
  nothing needs to be manually cleared.

## 0.0.4-beta.4

### Added
- **Multiple relationship types**: "Getrouwd" is now one of three choices -
  Getrouwd (married), Geregistreerd partnerschap (registered partnership),
  or Relatie (relationship) - replacing the earlier married/not-married
  checkbox with a proper 3-way picker. An informal "Relatie" link with no
  known date now shows no date-related text at all (not even "datum
  onbekend"), since a precise start date usually isn't the point for that
  kind of relationship.
- **A couple's anniversary is now a real, independent entity**, not just a
  computed row shown inside the cards. Linking two people with a known
  date creates a genuine `life_events.*` entity for their anniversary -
  visible under Settings → Entities, usable in automations, with its own
  working countdown. It's kept in sync automatically (created when a date
  becomes known, updated when the date changes, removed on unlinking or
  when either partner is removed) and is read-only/delete-only in the
  cards, since editing its date directly would desync it from the two
  partners' own records.

### Changed
- **If a card's `event_types` config is set to something like `[birthday]`
  (hiding anniversaries), a linked couple's anniversary will no longer
  show up on it** - previously it always appeared regardless of that
  filter, since it wasn't a real, independently-typed entity yet. Add
  `anniversary` to a card's `event_types` list if you want couples'
  anniversaries to keep showing there.

## 0.0.4-beta.3

### Added
- **"Children of X" on a parent's own record**: as soon as a parent is
  linked to a child, the parent's own details popup now shows a
  "Kinderen" row listing them back - computed live, updates immediately
  when a link is added, changed, or removed (no separate "children" field
  to maintain, it's the reverse of the child's own linked parents).

### Fixed
- **Searchable dropdowns (parent/spouse/phone-country pickers) could get
  clipped halfway** when the combobox sat low in a long edit popup - the
  list now flips upward and caps its own height to whatever room actually
  exists, instead of always opening downward with a fixed height that
  could run past the popup's edge.

## 0.0.4-beta.2

### Added
- **Unmarried partners**: linking two people no longer has to mean a
  wedding - a new "Dit is een huwelijk" checkbox on the link mini-form
  (checked by default, so every existing link stays a marriage unchanged)
  lets you record a partnership without one. Cards, wording, and the
  wedding-anniversary nicknames (zilveren bruiloft, etc.) all adapt - an
  unmarried partnership shows a plain "X jaar samen" instead.
- **Marriage/partnership date is now optional**: not everyone's exact
  anniversary date is known. Linking without one now asks for confirmation
  first, then records the link anyway - the couple/partners show up
  correctly everywhere, just without an anniversary occasion until the
  date is filled in later (a new "Datum toevoegen" action appears on their
  record for exactly that).
- **Parent-child linking**: any person can be linked to up to 2 parents
  (optional, not required to match) via two new searchable pickers on the
  edit form - unlike the spouse picker, any person can be a parent
  regardless of type, so a deceased grandparent can be linked too.
- **Phone number of linked parents**: a person's details popup now shows
  the phone number of each linked parent that has one set, resolved live -
  this is what originally motivated the parent-linking feature: seeing a
  child's parents' phone numbers without re-entering them.

## 0.0.4-beta.1

### Fixed
- **Entity deletion left orphaned registry entries**: deleting an event (or
  replacing it during an import) only cleared its state, not its entity
  registry entry, leaving HA's "this entity is no longer provided" warning
  behind. Now uses the entity registry's own removal path, which also
  cleans up the state as a side effect.
- **Spouse-select dropdown was unsorted**: the marriage-linking picker now
  lists candidates alphabetically, and both it and the phone country picker
  are now a searchable combobox (type to filter) instead of a plain
  dropdown/`<select>`.
- **Marriage attributes leaked untranslated into the custom-attributes
  list**: `spouse_naam`-style raw attribute names no longer show up as
  generic rows; a married person's details popup now shows one friendly,
  translated "Getrouwd met ... sinds ..." line instead. The same fix also
  covers two previously-leaking deceased-related attributes
  (`years_since_death`, `days_until_death_anniversary`).
- **Phone country field overflowed the popup**: the country selector is
  now a narrow, fixed-width searchable combobox showing just the dial code
  (e.g. `+31`) once chosen, so the phone number field next to it no longer
  gets pushed outside the popup.

### Added
- **Composable date-format picker**: the old 3 fixed presets (short/medium/
  long) are replaced with 4 independent controls - weekday on/off, month as
  digits or name, day-first or month-first order, year on/off - covering
  the full spectrum from `dd-mm-yyyy` to `dddd dd mmmm yyyy` and everything
  in between. Existing configs keep working unchanged.

## 0.0.3

Second real (non-prerelease) release. No real `0.0.2` was ever cut -
development continued straight through in beta from `0.0.2-beta.1` to
`0.0.3-beta.7`; this entry summarizes all of it.

### Added
- **Custom attributes**: a freeform key/value editor (e.g. `relatie`,
  `geslacht`) on every card's add/edit form, plus **fixed (required)
  attributes** configurable per install via the Manage card's editor (e.g.
  a required `geslacht` dropdown restricted to `man`/`vrouw`/`anders`) -
  enforced both client-side and server-side, and a **backfill overview**
  pill on the Manage card showing how many events are still missing a
  given required attribute, with one click to filter to just those.
- **Full i18n**: both the integration and the three cards auto-detect
  `hass.language` (Dutch, English, German, French shipped; anything else
  falls back to English then Dutch) - no setting to configure, and adding
  a new language is just translating one JSON file.
- **Two occasions per deceased person**: a deceased person with a death
  date now appears in the Upcoming/Month overview as both their birthday
  (age-less, unchanged) and their death anniversary (years-since-death
  shown), rather than one merged row.
- **Marriage/anniversary linking between two people**: "Trouwen" on a
  living person's edit form links them to an existing person (or a
  brand-new one created inline) with a shared marriage date; the couple
  then shows as one combined "A & B" wedding-anniversary occasion in the
  overview. "Scheiden" unlinks a living couple. A married person's link
  survives their death; a widow(er) remarrying only updates their own
  record, leaving their late spouse's marriage history untouched.
  Milestone anniversaries (25/40/50/60 years) show a per-language
  nickname (zilveren/gouden bruiloft, etc.).
- **"Edit as YAML"** in the add/edit popup: a schema-specific (not
  general-purpose) raw-text view of an event's fields, with the same
  validation as the normal form.
- **Per-card date-format picker**: short (`dd-mm-jjjj`, default), medium
  (`dd maand jjjj`) or long (`weekdag dd maand`), locale-correct.
- Every card row is clickable: a read-only details popup on the
  Upcoming/Month cards (with a "Bewerken" button that swaps into the same
  edit form the Manage card uses), direct edit on the Manage card.
  Manage's list starts empty with search/month/gender/custom-attribute
  filters instead of dumping everything at once.
- Optional **birth time** field, live **countdown** timer to the next
  Upcoming event, **collapsible** cards, sortable **Month card** table
  headers, a **"Life Events" label** applied to every entity for easy
  filtering in Settings.
- A live, ticking "wordt **X** op donderdag" (bold age + locale-correct
  weekday) inline text on the Upcoming card.

### Fixed
- **The recurring "typing gets silently wiped" bug class**, in every
  place it turned up over this line's development (the Manage card's
  add/edit form and search box, the Upcoming/Month cards' edit popup, all
  three cards' visual config editors): `hass` updates fire on *any*
  entity's state change anywhere in HA, and a naive full re-render wiped
  in-progress input. Eventually fixed structurally rather than per-spot -
  `LifeEventsBaseCard` now detects an open modal from the actual rendered
  DOM instead of relying on each card to remember a suppression flag, and
  every editor re-render preserves focus/cursor position by construction.
- Entities weren't properly tied to the config entry's device/entity
  registry (Settings → Devices & services undercounted them), and
  `friendly_name` was showing an unwanted device-name prefix on every
  person - both traced to HA's device-linking/legacy-naming internals and
  fixed by not grouping event entities under a shared device at all.
- Selecting text inside the edit popup (click-drag near the edge) could
  close the whole popup mid-selection; hover on live card rows could
  flicker on every unrelated `hass` tick (fixed by skipping DOM rebuilds
  when nothing actually changed); a fixed-attribute dropdown failed to
  pre-select a stored value that only differed in casing.

### Changed
- Naam split into separate Voornaam/Achternaam fields (still stored as
  one combined name everywhere else).
- Deleting an event uses an inline confirm step instead of the browser's
  native `confirm()`.
- Removed a duplicate "Vandaag!" on the Upcoming card; renamed its
  default title away from "verjaardagen" since it covers all event types.

## 0.0.1

First real (non-prerelease) release, consolidating everything from
`1.0.0-beta.1` through `1.0.0-beta.8`: the rename from `ha-birthdays`
(domain `birthdays` → `life_events`) on top of that project's
rearchitecture from a YAML-only integration into a config-entry
integration; a phone number field (E.164, with a country-code picker) and
a matching notification automation blueprint; an example dashboard; a
logo; the add/edit-event and import/export panels moved into a popup;
button-mode display option for the Manage card; a live search/month
filter; and several real bugfixes along the way (a `calendar.py`
thread-safety issue, the Manage card's first "typing gets wiped" bug,
config editor fields silently failing to render, stale-cache handling for
the served card JS).

Versioned `0.0.1` rather than `1.0.0` deliberately: development continues
in beta (`0.0.x-beta.N`) until the integration is considered ready for a
real `1.0.0`.

**Kept for backwards compatibility throughout:** the legacy `birthdays:`
YAML top-level key is still auto-imported once on first setup; the HA bus
event fired on every occurrence is still named `birthday`; every entity
still exposes a `date_of_birth` attribute regardless of `event_type` -
existing automations/dashboards/templates from the original
`ha-birthdays` integration keep working unmodified.

## Inherited from ha-birthdays v2.0.0-beta.1

- Config-entry based setup (Settings → Devices & services → Add
  integration), backed by Home Assistant Storage instead of
  `configuration.yaml`.
- Automatic one-time import of a legacy `birthdays:` YAML config into
  storage on first setup, preserving existing entity_ids.
- `event_type` concept: `birthday`, `anniversary`, `deceased`. Legacy YAML
  entries are heuristically classified (name/unique_id containing
  "trouwdag"/"jubileum"/"anniversary" → anniversary, everything else →
  birthday).
- `date_of_death` field for `deceased` events.
- Three bundled Lovelace cards with visual editors, auto-registered as a
  frontend resource, no separate HACS plugin install step needed.
- Templated attributes (Jinja templates as attribute values in YAML
  config) are no longer supported, same as in that release.

## 1.3.0 and earlier

See the original upstream project:
https://github.com/Miicroo/ha-birthdays
