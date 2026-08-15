/**
 * Life Events cards
 * ----------------
 * Three self-contained (no build step, no external deps) Lovelace cards for
 * the Life Events integration, each with its own visual (GUI) editor:
 *
 *   - life-events-upcoming-card : list of events happening in the next N days
 *   - life-events-month-card    : month picker + table (mirrors the original
 *                                button-grid + markdown-table dashboard)
 *   - life-events-manage-card   : add / edit / delete / import / export events
 *
 * All three read entities in the `life_events.*` domain and rely on the
 * attributes the integration exposes on every entity: date_of_birth
 * (the reference date, used for every event type for backwards
 * compatibility), age_at_next_birthday, event_type, and (for deceased
 * persons) date_of_death.
 *
 * IMPORTANT - read before adding any new popup/form/filter with an input:
 * -----------------------------------------------------------------------
 * `hass` is reassigned on EVERY entity state change anywhere in the whole
 * HA instance, not just this integration's own entities - it fires
 * constantly. LifeEventsBaseCard's `set hass()` guards against this by
 * skipping `_render()` while any `.bd-modal-backdrop` is in the shadow DOM
 * (see that method), so a normal add/edit/details popup is safe *for
 * free* - you don't need to do anything extra for it.
 *
 * This has still broken multiple times in this file's history (typing
 * getting silently wiped mid-keystroke) whenever a NEW kind of always-
 * visible, non-modal input was added - e.g. the Manage card's search/
 * month/gender/attribute filter bar, which lives directly in the panel
 * body, not inside a `.bd-modal-backdrop`. The DOM-based guard above can't
 * see those. If you add another always-visible (non-modal) input:
 *   1. Give the card its own `get hass()`/`set hass()` override (see
 *      LifeEventsManageCard for the pattern) instead of relying on the
 *      base class.
 *   2. Route ordinary hass ticks through a *targeted* DOM update (e.g.
 *      `_renderList()`, replacing only the read-only content) rather than
 *      a full `_render()` - a full `_render()` always wipes whatever the
 *      user is mid-typing, modal or not.
 *   3. Verify it with a real browser test that specifically simulates an
 *      unrelated `hass` tick while typing (see
 *      logo-drafts/hass-tick-suppression-test.html for the pattern) -
 *      this class of bug does not show up from reading the code, only
 *      from actually exercising it at runtime.
 */
(() => {
  // Bump alongside manifest.json's version. Check this in the browser
  // console after an update to confirm the fresh file actually loaded,
  // rather than a stale cached copy - see CHANGELOG 1.0.0-beta.4.
  console.info("Life Events cards: v1.0.1 loaded");

  const DOMAIN = "life_events";

  // ---------------------------------------------------------------------
  // i18n: language auto-detected from `hass.language` (no user setting
  // needed). Dutch is the only language baked directly into this file (zero
  // network requests, always available even if translations/ can't be
  // fetched for some reason); every other language lives in its own
  // `translations/<lang>.json` file next to this script and is fetched
  // lazily the first time it's needed. Adding a new language is just
  // dropping a new JSON file in that folder (copy translations/en.json,
  // translate the values) and adding its code to SUPPORTED_LANGS below -
  // no JS changes, so the community can contribute translations directly.
  // ---------------------------------------------------------------------
  const SUPPORTED_LANGS = ["nl", "en", "de", "fr"];

  const TRANSLATIONS_NL = {
    months: ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"],
    event_type_birthday: "Verjaardag",
    event_type_anniversary: "Jubileum",
    event_type_deceased: "Overleden",
    label_date: "Datum",
    label_name: "Naam",
    label_type: "Type",
    label_age: "Leeftijd",
    label_time: "Tijd",
    label_becomes: "Wordt",
    label_date_of_death: "Datum van overlijden",
    label_phone: "Telefoonnummer",
    label_import_export: "Import / export",
    inline_becomes: "wordt <b>{age}</b> op {weekday}",
    countdown_today: "Vandaag!",
    countdown_format: "Nog {days} dagen {hours} uur {minutes} min {seconds} sec",
    upcoming_empty: "Geen aankomende gebeurtenissen in de komende {days} dagen.",
    month_empty: "Geen gebeurtenissen in {month}.",
    attr_key_placeholder: "Naam (bv. relatie, geslacht)",
    attr_value_placeholder: "Waarde",
    field_firstname: "Voornaam",
    field_lastname: "Achternaam (optioneel)",
    field_birth_time: "Geboortetijd (optioneel, bv. van het geboortekaartje)",
    field_date_of_death: "Datum van overlijden (alleen bij type 'Overleden')",
    field_icon: "Icoon (optioneel, bv. mdi:cake)",
    field_phone: "Telefoonnummer (optioneel, alleen zinvol bij 'Verjaardag'/'Jubileum')",
    phone_placeholder: "0612345678",
    phone_country_search_placeholder: "Zoek land...",
    field_custom_attrs: "Aangepaste attributen (optioneel, bv. relatie, geslacht - zelf te bepalen)",
    action_add_attr: "+ Attribuut toevoegen",
    confirm_delete_question: "Deze gebeurtenis verwijderen?",
    action_delete_confirm: "Ja, verwijderen",
    action_cancel: "Annuleren",
    action_save: "Opslaan",
    action_add: "Toevoegen",
    action_delete: "Verwijderen",
    action_edit: "Bewerken",
    action_export: "Exporteren",
    action_download: "Download bestand",
    action_import: "Importeren",
    action_close: "Sluiten",
    action_add_button: "+ Toevoegen",
    action_open_panel: "Beheer openen",
    validation_required: "Voornaam en datum zijn verplicht.",
    editor_title: "Titel",
    editor_days_ahead: "Aantal dagen vooruit",
    editor_show_icon: "Toon icoon",
    editor_collapsible: "Inklapbaar (pijlknop in de kaart)",
    editor_show_parent_phone: "Toon telefoonnummer van ouders",
    editor_type_filter: "Type filter (leeg = alles)",
    editor_columns: "Aantal kolommen (maandknoppen)",
    editor_display_mode_label: "Weergave",
    editor_display_mode_full: "Volledige kaart",
    editor_display_mode_button: "Knop die als popup opent",
    panel_choose_filter: "Kies eerst een filter (zoeken, maand, geslacht of een attribuut) om gebeurtenissen te tonen.",
    panel_no_results: "Geen gebeurtenissen gevonden.",
    io_format_label: "Formaat",
    io_mode_label: "Modus bij importeren",
    io_mode_merge: "Samenvoegen",
    io_mode_replace: "Vervangen",
    io_file_label: "Bestand kiezen (optioneel, vult de inhoud hieronder)",
    io_content_label: "Inhoud (plak hier, kies een bestand hierboven, of gebruik Exporteren om te vullen)",
    search_placeholder: "Zoek op naam...",
    filter_all_months: "Alle maanden",
    filter_all_genders: "Alle geslachten",
    gender_man: "Man",
    gender_vrouw: "Vrouw",
    gender_anders: "Anders",
    filter_choose_attribute: "Kies attribuut...",
    filter_all_values: "Alle waarden",
    manage_default_title: "Beheren",
    status_saved: "Opgeslagen.",
    io_file_loaded: "Bestand '{file}' geladen. Controleer de inhoud en klik op Importeren.",
    io_file_error: "Kon '{file}' niet lezen.",
    io_export_done: "Export klaar.",
    io_import_nothing: "Niets om te importeren.",
    io_import_done: "Geïmporteerd: {count} gebeurtenissen.",
    fixed_attr_choose: "-- kies --",
    validation_required_fixed: "{key} is verplicht.",
    fixed_attrs_section_title: "Vaste (verplichte) attributen",
    fixed_attrs_section_hint: "Deze gelden voor de hele installatie en verschijnen verplicht op elk bewerkformulier.",
    fixed_attr_key_placeholder: "Naam (bv. geslacht)",
    fixed_attr_kind_text: "Vrije tekst",
    fixed_attr_kind_dropdown: "Keuzelijst",
    fixed_attr_options_placeholder: "Opties, komma-gescheiden (bv. Man, Vrouw, Anders)",
    action_add_fixed_attr: "+ Vast attribuut toevoegen",
    action_save_fixed_attrs: "Vaste attributen opslaan",
    deceased_years_ago: "{years} jaar geleden overleden",
    deceased_years_ago_short: "{years} jaar geleden",
    backfill_pill_label: "{key}: {count} ontbrekend",
    editor_date_format: "Datumnotatie",
    date_format_show_weekday: "Toon weekdag",
    date_format_month_label: "Maandnotatie",
    date_format_month_numeric: "Cijfers (05)",
    date_format_month_name: "Naam (mei)",
    date_format_order_label: "Volgorde",
    date_format_order_dm: "Dag eerst",
    date_format_order_md: "Maand eerst",
    date_format_show_year: "Toon jaartal",
    action_edit_yaml: "Bewerk als YAML",
    action_edit_form: "Terug naar formulier",
    yaml_edit_hint: "Technische veldnamen (Engels), niet vertaald - net als YAML-bewerken elders in Home Assistant.",
    validation_invalid_fixed_option: "{key} moet een van de toegestane waarden zijn.",
    marriage_section_title: "Huwelijk",
    label_married_to: "Getrouwd met {name} sinds {date}",
    marriage_partner_since: "{name} (sinds {date})",
    action_divorce: "Scheiden",
    marriage_pick_spouse_label: "Kies partner...",
    marriage_new_person_option: "+ Nieuw persoon aanmaken",
    new_spouse_firstname_label: "Voornaam nieuwe partner",
    new_spouse_lastname_label: "Achternaam nieuwe partner (optioneel)",
    new_spouse_birthdate_label: "Geboortedatum nieuwe partner",
    marriage_date_label: "Trouwdatum",
    action_confirm_marriage: "Bevestig huwelijk",
    confirm_divorce_question: "Dit huwelijk ontkoppelen?",
    action_divorce_confirm: "Ja, scheiden",
    marriage_anniversary_inline: "{years}-jarig huwelijk",
    marriage_anniversary_years_short: "{years} jaar getrouwd",
    partnership_section_title: "Relatie",
    label_partner_of: "Partner van {name} sinds {date}",
    label_married_to_no_date: "Getrouwd met {name} (datum onbekend)",
    label_partner_of_no_date: "Partner van {name} (datum onbekend)",
    marriage_partner_no_date: "{name} (datum onbekend)",
    action_end_partnership: "Relatie beëindigen",
    confirm_end_partnership_question: "Deze relatie ontkoppelen?",
    action_end_partnership_confirm: "Ja, beëindigen",
    partnership_anniversary_inline: "{years} jaar samen",
    partnership_anniversary_years_short: "{years} jaar samen",
    relationship_type_field_label: "Soort relatie",
    relationship_type_option_married: "Getrouwd",
    relationship_type_option_registered_partnership: "Geregistreerd partnerschap",
    relationship_type_option_relationship: "Relatie",
    registered_partnership_section_title: "Geregistreerd partnerschap",
    label_partner_of_bare: "Partner van {name}",
    label_anniversary_nickname: "Mijlpaal",
    primary_contact_section_title: "Primair contact",
    primary_contact_hint: "Welk telefoonnummer moet gebruikt worden voor automatiseringen (bijv. WhatsApp)?",
    primary_contact_self_option: "Zelf",
    label_primary_contact_value: "{name} ({number})",
    primary_contact_inline: "Primair: {name} ({number})",
    action_confirm_partnership: "Bevestig partnerschap",
    action_add_marriage_date: "Datum toevoegen",
    confirm_no_marriage_date_question: "Weet je zeker dat de datum (nog) niet bekend is?",
    action_confirm_no_date: "Ja, doorgaan zonder datum",
    parent_section_title: "Ouders",
    parent_1_pick_label: "Kies ouder 1...",
    parent_2_pick_label: "Kies ouder 2...",
    parent_none_option: "— geen —",
    label_parent_phone: "Telefoon van {name}",
    new_parent_firstname_label: "Voornaam nieuwe ouder",
    new_parent_lastname_label: "Achternaam nieuwe ouder (optioneel)",
    new_parent_birthdate_label: "Geboortedatum nieuwe ouder",
    children_section_title: "Kinderen",
    parents_section_title: "Ouders",
  };

  // Absolute directory this script itself was loaded from, used to fetch
  // translations/<lang>.json next to it regardless of how HA mounts this
  // integration's www/ folder (HACS path, /local/, custom extra_module_url,
  // ...). Must be captured synchronously at the top of the script, before
  // any `await`/callback - document.currentScript is only valid during the
  // script's initial, synchronous execution.
  const SCRIPT_BASE_URL = (() => {
    const cur = document.currentScript;
    return cur && cur.src ? cur.src.replace(/[^/]*$/, "") : "";
  })();

  // lang -> dict. "nl" is pre-seeded (it's the inline object above, never
  // fetched); other languages are added here once their JSON file loads.
  const translationsCache = { nl: TRANSLATIONS_NL };
  const translationsPromises = {};

  function resolveLang(hass) {
    const raw = ((hass && hass.language) || "nl").toLowerCase();
    const base = raw.split("-")[0];
    return SUPPORTED_LANGS.includes(base) ? base : "en";
  }

  // Kicks off a fetch for `hass`'s language if it isn't cached yet (a no-op
  // if it's "nl", already loaded, or already loading) and calls `onLoaded`
  // once it lands. Safe to call on every `hass` tick - after the first
  // successful load it does nothing further, so this never causes repeated
  // re-renders the way a naive "reload on every tick" would.
  function ensureTranslations(hass, onLoaded) {
    const lang = resolveLang(hass);
    if (lang === "nl" || translationsCache[lang]) return;
    if (!translationsPromises[lang]) {
      translationsPromises[lang] = fetch(`${SCRIPT_BASE_URL}translations/${lang}.json`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
        .then((json) => {
          if (json) translationsCache[lang] = json;
        });
    }
    translationsPromises[lang].then(() => {
      if (translationsCache[lang] && onLoaded) onLoaded();
    });
  }

  // Set at the start of every render pass (see setLangFor()) and read by
  // t()/months()/eventTypeLabel() for the rest of that pass. A module-level
  // variable rather than threading a `lang`/`dict` parameter through every
  // render helper - safe because a render pass runs synchronously start to
  // finish (nothing async happens between setLangFor() and the DOM write),
  // so nothing else can change it mid-render.
  let currentTranslations = TRANSLATIONS_NL;

  // Kept alongside currentTranslations - Intl.DateTimeFormat needs an
  // actual BCP-47 locale tag (for locale-correct weekday/month names via
  // the browser's own data, not a hand-maintained table like the rest of
  // this file's i18n), not the translation dictionary object.
  let currentLangCode = "nl";

  function setLangFor(hass) {
    currentLangCode = resolveLang(hass);
    currentTranslations = translationsCache[currentLangCode] || TRANSLATIONS_NL;
  }

  function weekdayName(date) {
    return new Intl.DateTimeFormat(currentLangCode, { weekday: "long" }).format(date);
  }

  function monthName(date) {
    return new Intl.DateTimeFormat(currentLangCode, { month: "long" }).format(date);
  }

  // Looks up `key` in the current language, falling back to Dutch (always
  // available) and finally to the raw key if truly missing. `vars`, if
  // given, fills in `{name}` placeholders (e.g. t("upcoming_empty", { days: 14 })).
  function t(key, vars) {
    const dict = currentTranslations;
    let str = (dict && dict[key] != null ? dict[key] : null) ?? (TRANSLATIONS_NL[key] != null ? TRANSLATIONS_NL[key] : null) ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) str = str.split(`{${k}}`).join(v);
    }
    return str;
  }

  function months() {
    return (currentTranslations && currentTranslations.months) || TRANSLATIONS_NL.months;
  }

  function eventTypeLabel(type) {
    const key = `event_type_${type}`;
    return (currentTranslations && currentTranslations[key]) || TRANSLATIONS_NL[key] || type;
  }

  // ---------------------------------------------------------------------
  // Fixed (required) custom-attribute schema: e.g. a required "geslacht"
  // dropdown with Man/Vrouw/Anders. Configured once, install-wide, via the
  // Manage card's editor (see LifeEventsManageCardEditor) - not hardcoded
  // into the integration, since it shouldn't be forced on other installs -
  // and then rendered + enforced on every card's add/edit form. Each
  // definition is `{ key, options }`: `options` absent means a required
  // free-text field, present means a required dropdown restricted to those
  // values. The backend (manager.py's _check_required_attributes) enforces
  // the same rule independently of this UI, for direct service/automation
  // calls that bypass the cards entirely.
  //
  // Loaded lazily via the get_fixed_attributes service and cached at module
  // level - the same once-per-session pattern as translations (see
  // ensureTranslations), since this rarely changes and every render/form
  // needs synchronous access to it. A save from the editor updates this
  // cache directly (see LifeEventsManageCardEditor's save-fixed-attrs
  // handler) so that tab reflects the change immediately; other already-
  // open cards/tabs pick it up on their own next load, same tradeoff as
  // every other piece of config in this file.
  let fixedAttrsCache = [];
  let fixedAttrsLoaded = false;
  let fixedAttrsPromise = null;

  function ensureFixedAttributes(hass, onLoaded) {
    if (fixedAttrsLoaded || !hass) return;
    if (!fixedAttrsPromise) {
      fixedAttrsPromise = callService(hass, "get_fixed_attributes", {}, true)
        .then((res) => {
          fixedAttrsCache = (res && res.fixed_attributes) || [];
        })
        .catch(() => {})
        .then(() => {
          fixedAttrsLoaded = true;
        });
    }
    fixedAttrsPromise.then(() => {
      if (onLoaded) onLoaded();
    });
  }

  const EVENT_TYPE_ICONS = {
    birthday: "mdi:cake",
    anniversary: "mdi:ring",
    deceased: "mdi:flower",
  };

  // Event types the phone number field applies to (not "deceased").
  const PHONE_EVENT_TYPES = ["birthday", "anniversary"];

  // [ISO 3166-1 alpha-2, ITU calling code, name]. Sorted with NL first (the
  // default selection), then alphabetically by name. Countries sharing a
  // calling code (NANP, several African/Caribbean +1 territories, Russia/
  // Kazakhstan +7, etc.) are listed as separate, individually selectable
  // entries for clarity, same as most international phone-input widgets.
  const COUNTRY_CODES = [
    ["NL", "31", "Nederland"],
    ["AF", "93", "Afghanistan"], ["AL", "355", "Albanië"], ["DZ", "213", "Algerije"],
    ["AS", "1684", "Amerikaans-Samoa"], ["AD", "376", "Andorra"], ["AO", "244", "Angola"],
    ["AI", "1264", "Anguilla"], ["AG", "1268", "Antigua en Barbuda"], ["AR", "54", "Argentinië"],
    ["AM", "374", "Armenië"], ["AW", "297", "Aruba"], ["AU", "61", "Australië"],
    ["AT", "43", "Oostenrijk"], ["AZ", "994", "Azerbeidzjan"], ["BS", "1242", "Bahama's"],
    ["BH", "973", "Bahrein"], ["BD", "880", "Bangladesh"], ["BB", "1246", "Barbados"],
    ["BY", "375", "Wit-Rusland"], ["BE", "32", "België"], ["BZ", "501", "Belize"],
    ["BJ", "229", "Benin"], ["BM", "1441", "Bermuda"], ["BT", "975", "Bhutan"],
    ["BO", "591", "Bolivia"], ["BA", "387", "Bosnië en Herzegovina"], ["BW", "267", "Botswana"],
    ["BR", "55", "Brazilië"], ["IO", "246", "Brits Indische Oceaanterritorium"],
    ["VG", "1284", "Britse Maagdeneilanden"], ["BN", "673", "Brunei"], ["BG", "359", "Bulgarije"],
    ["BF", "226", "Burkina Faso"], ["BI", "257", "Burundi"], ["KH", "855", "Cambodja"],
    ["CM", "237", "Kameroen"], ["CA", "1", "Canada"], ["CV", "238", "Kaapverdië"],
    ["KY", "1345", "Kaaimaneilanden"], ["CF", "236", "Centraal-Afrikaanse Republiek"],
    ["TD", "235", "Tsjaad"], ["CL", "56", "Chili"], ["CN", "86", "China"],
    ["CX", "61", "Christmaseiland"], ["CO", "57", "Colombia"], ["KM", "269", "Comoren"],
    ["CG", "242", "Congo-Brazzaville"], ["CD", "243", "Congo-Kinshasa"], ["CK", "682", "Cookeilanden"],
    ["CR", "506", "Costa Rica"], ["CI", "225", "Ivoorkust"], ["HR", "385", "Kroatië"],
    ["CU", "53", "Cuba"], ["CW", "599", "Curaçao"], ["CY", "357", "Cyprus"],
    ["CZ", "420", "Tsjechië"], ["DK", "45", "Denemarken"], ["DJ", "253", "Djibouti"],
    ["DM", "1767", "Dominica"], ["DO", "1809", "Dominicaanse Republiek"], ["EC", "593", "Ecuador"],
    ["EG", "20", "Egypte"], ["SV", "503", "El Salvador"], ["GQ", "240", "Equatoriaal-Guinea"],
    ["ER", "291", "Eritrea"], ["EE", "372", "Estland"], ["SZ", "268", "Eswatini"],
    ["ET", "251", "Ethiopië"], ["FK", "500", "Falklandeilanden"], ["FO", "298", "Faeröer"],
    ["FJ", "679", "Fiji"], ["FI", "358", "Finland"], ["FR", "33", "Frankrijk"],
    ["GF", "594", "Frans-Guyana"], ["PF", "689", "Frans-Polynesië"], ["GA", "241", "Gabon"],
    ["GM", "220", "Gambia"], ["GE", "995", "Georgië"], ["DE", "49", "Duitsland"],
    ["GH", "233", "Ghana"], ["GI", "350", "Gibraltar"], ["GR", "30", "Griekenland"],
    ["GL", "299", "Groenland"], ["GD", "1473", "Grenada"], ["GP", "590", "Guadeloupe"],
    ["GU", "1671", "Guam"], ["GT", "502", "Guatemala"], ["GN", "224", "Guinee"],
    ["GW", "245", "Guinee-Bissau"], ["GY", "592", "Guyana"], ["HT", "509", "Haïti"],
    ["HN", "504", "Honduras"], ["HK", "852", "Hongkong"], ["HU", "36", "Hongarije"],
    ["IS", "354", "IJsland"], ["IN", "91", "India"], ["ID", "62", "Indonesië"],
    ["IR", "98", "Iran"], ["IQ", "964", "Irak"], ["IE", "353", "Ierland"],
    ["IL", "972", "Israël"], ["IT", "39", "Italië"], ["JM", "1876", "Jamaica"],
    ["JP", "81", "Japan"], ["JO", "962", "Jordanië"], ["KZ", "7", "Kazachstan"],
    ["KE", "254", "Kenia"], ["KI", "686", "Kiribati"], ["XK", "383", "Kosovo"],
    ["KW", "965", "Koeweit"], ["KG", "996", "Kirgizië"], ["LA", "856", "Laos"],
    ["LV", "371", "Letland"], ["LB", "961", "Libanon"], ["LS", "266", "Lesotho"],
    ["LR", "231", "Liberia"], ["LY", "218", "Libië"], ["LI", "423", "Liechtenstein"],
    ["LT", "370", "Litouwen"], ["LU", "352", "Luxemburg"], ["MO", "853", "Macau"],
    ["MG", "261", "Madagaskar"], ["MW", "265", "Malawi"], ["MY", "60", "Maleisië"],
    ["MV", "960", "Maldiven"], ["ML", "223", "Mali"], ["MT", "356", "Malta"],
    ["MH", "692", "Marshalleilanden"], ["MQ", "596", "Martinique"], ["MR", "222", "Mauritanië"],
    ["MU", "230", "Mauritius"], ["YT", "262", "Mayotte"], ["MX", "52", "Mexico"],
    ["FM", "691", "Micronesië"], ["MD", "373", "Moldavië"], ["MC", "377", "Monaco"],
    ["MN", "976", "Mongolië"], ["ME", "382", "Montenegro"], ["MS", "1664", "Montserrat"],
    ["MA", "212", "Marokko"], ["MZ", "258", "Mozambique"], ["MM", "95", "Myanmar"],
    ["NA", "264", "Namibië"], ["NR", "674", "Nauru"], ["NP", "977", "Nepal"],
    ["NC", "687", "Nieuw-Caledonië"], ["NZ", "64", "Nieuw-Zeeland"], ["NI", "505", "Nicaragua"],
    ["NE", "227", "Niger"], ["NG", "234", "Nigeria"], ["NU", "683", "Niue"],
    ["KP", "850", "Noord-Korea"], ["MK", "389", "Noord-Macedonië"], ["NO", "47", "Noorwegen"],
    ["OM", "968", "Oman"], ["PK", "92", "Pakistan"], ["PW", "680", "Palau"],
    ["PS", "970", "Palestina"], ["PA", "507", "Panama"], ["PG", "675", "Papoea-Nieuw-Guinea"],
    ["PY", "595", "Paraguay"], ["PE", "51", "Peru"], ["PH", "63", "Filipijnen"],
    ["PL", "48", "Polen"], ["PT", "351", "Portugal"], ["PR", "1787", "Puerto Rico"],
    ["QA", "974", "Qatar"], ["RE", "262", "Réunion"], ["RO", "40", "Roemenië"],
    ["RU", "7", "Rusland"], ["RW", "250", "Rwanda"], ["WS", "685", "Samoa"],
    ["SM", "378", "San Marino"], ["ST", "239", "Sao Tomé en Principe"], ["SA", "966", "Saoedi-Arabië"],
    ["SN", "221", "Senegal"], ["RS", "381", "Servië"], ["SC", "248", "Seychellen"],
    ["SL", "232", "Sierra Leone"], ["SG", "65", "Singapore"], ["SX", "1721", "Sint-Maarten"],
    ["SK", "421", "Slowakije"], ["SI", "386", "Slovenië"], ["SB", "677", "Salomonseilanden"],
    ["SO", "252", "Somalië"], ["ZA", "27", "Zuid-Afrika"], ["KR", "82", "Zuid-Korea"],
    ["SS", "211", "Zuid-Soedan"], ["ES", "34", "Spanje"], ["LK", "94", "Sri Lanka"],
    ["SD", "249", "Soedan"], ["SR", "597", "Suriname"], ["SE", "46", "Zweden"],
    ["CH", "41", "Zwitserland"], ["SY", "963", "Syrië"], ["TW", "886", "Taiwan"],
    ["TJ", "992", "Tadzjikistan"], ["TZ", "255", "Tanzania"], ["TH", "66", "Thailand"],
    ["TL", "670", "Oost-Timor"], ["TG", "228", "Togo"], ["TO", "676", "Tonga"],
    ["TT", "1868", "Trinidad en Tobago"], ["TN", "216", "Tunesië"], ["TR", "90", "Turkije"],
    ["TM", "993", "Turkmenistan"], ["TC", "1649", "Turks- en Caicoseilanden"], ["TV", "688", "Tuvalu"],
    ["UG", "256", "Oeganda"], ["UA", "380", "Oekraïne"], ["AE", "971", "Verenigde Arabische Emiraten"],
    ["GB", "44", "Verenigd Koninkrijk"], ["US", "1", "Verenigde Staten"], ["UY", "598", "Uruguay"],
    ["UZ", "998", "Oezbekistan"], ["VU", "678", "Vanuatu"], ["VA", "379", "Vaticaanstad"],
    ["VE", "58", "Venezuela"], ["VN", "84", "Vietnam"], ["YE", "967", "Jemen"],
    ["ZM", "260", "Zambia"], ["ZW", "263", "Zimbabwe"],
  ];

  const COUNTRY_BY_ISO = Object.fromEntries(COUNTRY_CODES.map((c) => [c[0], c]));

  // Shared by the phone field's render and bind steps - one source of
  // truth so they can't drift apart. `label` (full country name, used
  // while searching the list) vs. `shortLabel` (just the dial code, what
  // stays visible in the field once picked) is exactly the "options
  // spelled out, but compact after selection" split that was asked for.
  function phoneCountryOptions() {
    return COUNTRY_CODES.map((c) => ({ value: c[0], label: `${c[2]} (+${c[1]})`, shortLabel: `+${c[1]}` }));
  }

  /** Local-format input + a country's dial code -> E.164 (e.g. "0612345678" + NL -> "+31612345678"). */
  function toE164(localNumber, iso2) {
    const country = COUNTRY_BY_ISO[iso2] || COUNTRY_BY_ISO.NL;
    const digits = (localNumber || "").replace(/[^\d+]/g, "");
    if (!digits) return "";
    if (digits.startsWith("+")) return digits;
    if (digits.startsWith("00")) return `+${digits.slice(2)}`;
    const trimmed = digits.startsWith("0") ? digits.slice(1) : digits;
    return `+${country[1]}${trimmed}`;
  }

  /** Reverse of toE164, for pre-filling the edit form: E.164 -> { iso2, local }. */
  function fromE164(e164) {
    if (!e164) return { iso2: "NL", local: "" };
    const digits = e164.replace(/[^\d+]/g, "");
    if (!digits.startsWith("+")) return { iso2: "NL", local: digits };
    const withoutPlus = digits.slice(1);
    // Longest dial-code match first, so e.g. "1809" (DO) isn't shadowed by "1" (US/CA).
    const match = [...COUNTRY_CODES]
      .sort((a, b) => b[1].length - a[1].length)
      .find((c) => withoutPlus.startsWith(c[1]));
    if (!match) return { iso2: "NL", local: withoutPlus };
    return { iso2: match[0], local: `0${withoutPlus.slice(match[1].length)}` };
  }

  function css(strings, ...values) {
    return strings.reduce((acc, s, i) => acc + s + (values[i] ?? ""), "");
  }

  // Fixed attribute names the integration always sets on an event entity
  // (see entity.py's extra_state_attributes) plus the standard HA ones -
  // anything else in st.attributes is a user-defined custom attribute
  // (e.g. "relatie", "geslacht") and round-trips through the add_event/
  // update_event "attributes" object field.
  const RESERVED_EVENT_ATTRS = new Set([
    "friendly_name", "icon", "unit_of_measurement",
    "date_of_birth", "age_at_next_birthday", "event_type",
    "date_of_death", "phone_number", "time",
    "years_since_death", "days_until_death_anniversary",
    "spouse_id", "spouse_name", "marriage_date", "relationship_type",
    "days_until_marriage_anniversary", "years_at_next_marriage_anniversary",
    "parent_ids", "parent_names", "parent_phone_numbers", "children_ids", "children_names",
    "partner_ids", "partner_names",
    "primary_contact_id", "primary_phone_number", "primary_contact_name", "primary_whatsapp_link",
  ]);

  function customAttributesOf(st) {
    const out = {};
    for (const [key, value] of Object.entries(st.attributes)) {
      if (!RESERVED_EVENT_ATTRS.has(key)) out[key] = value;
    }
    return out;
  }

  // Wraps a cross-reference name (spouse/parent/child) as a clickable link
  // that navigates the currently-open details popup to that person's own
  // record instead - see bindDetailsOrEditModal's onNavigate/onBack for the
  // history stack that makes a "Terug" button work on the way back. Falls
  // back to plain (non-clickable) text if there's no id to navigate to.
  function navLink(id, name) {
    if (!id) return escapeAttr(name || "");
    return `<span class="le-nav-link" data-nav-id="${escapeAttr(id)}">${escapeAttr(name || id)}</span>`;
  }

  function escapeAttr(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function getEvents(hass, eventTypes) {
    if (!hass) return [];
    const allowed = eventTypes && eventTypes.length ? eventTypes : null;
    return Object.keys(hass.states)
      .filter((eid) => eid.startsWith(`${DOMAIN}.`))
      .map((eid) => hass.states[eid])
      .filter((st) => st.state !== "unknown" && st.state !== "unavailable")
      .map((st) => ({
        entity_id: st.entity_id,
        name: st.attributes.friendly_name || st.entity_id,
        icon: st.attributes.icon,
        days: Number(st.state),
        date: st.attributes.date_of_birth,
        age: st.attributes.age_at_next_birthday,
        eventType: st.attributes.event_type || "birthday",
        dateOfDeath: st.attributes.date_of_death,
        yearsSinceDeath: st.attributes.years_since_death,
        daysUntilDeathAnniversary: st.attributes.days_until_death_anniversary,
        spouseId: st.attributes.spouse_id,
        spouseName: st.attributes.spouse_name,
        marriageDate: st.attributes.marriage_date,
        relationshipType: st.attributes.relationship_type || "married",
        daysUntilMarriageAnniversary: st.attributes.days_until_marriage_anniversary,
        yearsAtNextMarriageAnniversary: st.attributes.years_at_next_marriage_anniversary,
        parentIds: st.attributes.parent_ids || [],
        parentNames: st.attributes.parent_names || [],
        parentPhoneNumbers: st.attributes.parent_phone_numbers || [],
        childrenIds: st.attributes.children_ids || [],
        childrenNames: st.attributes.children_names || [],
        partnerIds: st.attributes.partner_ids || [],
        partnerNames: st.attributes.partner_names || [],
        isCoupleAnniversary: (st.attributes.partner_ids || []).length === 2,
        phoneNumber: st.attributes.phone_number,
        primaryContactId: st.attributes.primary_contact_id,
        primaryPhoneNumber: st.attributes.primary_phone_number,
        primaryContactName: st.attributes.primary_contact_name,
        primaryWhatsappLink: st.attributes.primary_whatsapp_link,
        time: st.attributes.time,
        attributes: customAttributesOf(st),
      }))
      .filter((e) => !allowed || allowed.includes(e.eventType));
  }

  // Not exhaustive - only the most widely-recognized milestone-year
  // nicknames per language, deliberately kept modest to avoid overclaiming
  // folklore accuracy for less universally-agreed-on years. Keyed by the
  // same language codes as SUPPORTED_LANGS; a year/language with no entry
  // just shows the plain anniversary number, no nickname.
  const MARRIAGE_ANNIVERSARY_NICKNAMES = {
    nl: { 25: "zilveren bruiloft", 40: "robijnen bruiloft", 50: "gouden bruiloft", 60: "diamanten bruiloft" },
    en: { 25: "silver wedding", 40: "ruby wedding", 50: "golden wedding", 60: "diamond wedding" },
    de: { 25: "Silberhochzeit", 40: "Rubinhochzeit", 50: "Goldene Hochzeit", 60: "Diamantene Hochzeit" },
    fr: { 25: "noces d'argent", 40: "noces de rubis", 50: "noces d'or", 60: "noces de diamant" },
  };

  function marriageAnniversaryNickname(years) {
    const table = MARRIAGE_ANNIVERSARY_NICKNAMES[currentLangCode];
    return (table && table[years]) || null;
  }

  // Shared 3-way lookup for the "Huwelijk"/"Geregistreerd partnerschap"/
  // "Relatie" section title, keyed by relationshipType - used both in the
  // read-only details view and the link mini-form.
  function relationshipSectionTitleKey(relationshipType) {
    if (relationshipType === "registered_partnership") return "registered_partnership_section_title";
    if (relationshipType === "relationship") return "partnership_section_title";
    return "marriage_section_title";
  }

  // A deceased person (with a date_of_death) appears as an EXTRA occasion
  // in the "what's coming up" cards (Upcoming/Month), alongside their own
  // row: own row split into a birthday occasion (age-less, unchanged) and
  // a death-anniversary occasion (years-since-death shown) - the two are
  // independent, not merged.
  // A couple's wedding/relationship anniversary is NOT synthesized here -
  // it's a real, independent entity (event_type="anniversary",
  // isCoupleAnniversary via getEvents()'s partner_ids check), created/
  // updated by LifeEventsManager._upsert_anniversary_entity and flowing
  // through getEvents() unaided, same as any other entity.
  // Only used by those two cards' own event lists, NOT by getEvents()
  // itself: the Manage card's entity-management list (_baseEvents()) must
  // keep showing each real entity exactly once, so it must keep calling
  // getEvents() directly.
  function expandOccasions(events) {
    const out = [];
    events.forEach((e) => {
      let hasOwnSplit = false;
      if (e.eventType === "deceased" && e.dateOfDeath && e.daysUntilDeathAnniversary != null) {
        out.push({ ...e, isDeathAnniversary: false });
        out.push({ ...e, isDeathAnniversary: true, date: e.dateOfDeath, days: e.daysUntilDeathAnniversary });
        hasOwnSplit = true;
      }
      if (!hasOwnSplit) out.push(e);
    });
    return out;
  }

  // Normalizes any historical `date_format` config shape into a full
  // { weekday, month, order, year } object:
  //   - the legacy preset strings "medium"/"long" (kept working for any
  //     dashboard that already had one of these set before the composable
  //     picker below existed - "short"/undefined never reaches here, see
  //     formatDate()'s own early-return for that case).
  //   - a partial or full object from the new picker (missing keys default
  //     to the plain short-format equivalent, so a single-field update -
  //     see bindDateFormatFields() - never has to know the other three).
  function normalizeDateFormat(raw) {
    if (raw === "medium") return { weekday: false, month: "long", order: "dm", year: true };
    if (raw === "long") return { weekday: true, month: "long", order: "dm", year: false };
    const obj = raw && typeof raw === "object" ? raw : {};
    return {
      weekday: !!obj.weekday,
      month: obj.month === "long" ? "long" : "numeric",
      order: obj.order === "md" ? "md" : "dm",
      year: obj.year !== false,
    };
  }

  // `format`: undefined/"short" (default, dd-mm-yyyy, locale-agnostic -
  // unchanged behavior for anyone who never touches the per-card setting)
  // or anything normalizeDateFormat() above accepts - a fully composable
  // weekday/month-style/day-month-order/year picker, covering the whole
  // spectrum from "dd-mm-yyyy" through "dddd mmmm dd yyyy" (and every
  // other combination) rather than a fixed handful of presets. Weekday
  // and month names are locale-correct via Intl.DateTimeFormat and
  // currentLangCode (see weekdayName()/monthName()), so this is
  // "per-language" for free; the day/month/year digits and their
  // separators are composed by hand here instead of relying on Intl's own
  // whole-date formatting, since Intl has no way to force a token order
  // that isn't the locale's own default.
  function formatDate(iso, format) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!format || format === "short") return `${d}-${m}-${y}`;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    const cfg = normalizeDateFormat(format);
    const monthIsLong = cfg.month === "long";
    const monthStr = monthIsLong ? monthName(date) : String(m).padStart(2, "0");
    // No leading zero on the day when the month is spelled out ("5 mei",
    // not "05 mei") - matches how that's naturally written, unlike the
    // zero-padded numeric-month form ("05-05").
    const dayStr = monthIsLong ? String(Number(d)) : String(d).padStart(2, "0");
    const monthFirst = cfg.order === "md";
    let dateStr = monthIsLong
      ? monthFirst
        ? `${monthStr} ${dayStr}`
        : `${dayStr} ${monthStr}`
      : monthFirst
        ? `${monthStr}-${dayStr}`
        : `${dayStr}-${monthStr}`;
    if (cfg.year) {
      dateStr = monthIsLong ? `${dateStr} ${y}` : `${dateStr}-${y}`;
    }
    if (cfg.weekday) {
      dateStr = `${weekdayName(date)} ${dateStr}`;
    }
    return dateStr;
  }

  // Client-side only (the backend only exposes a whole-day count as
  // state): reconstructs the exact next-occurrence midnight from the
  // stored month/day, mirroring calendar.py's _next_occurrence logic, so
  // the Upcoming card's top row can show a live to-the-second countdown.
  function nextOccurrenceDate(iso) {
    const [, m, d] = iso.split("-").map(Number);
    const now = new Date();
    // Date-only comparison for the rollover decision (matching
    // calendar.py's _next_occurrence: `occurrence < today`, not
    // `<= now`) - otherwise "today is the day" always incorrectly rolls
    // over to next year, since midnight-today is virtually always
    // earlier than the current time-of-day.
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let target = new Date(now.getFullYear(), m - 1, d, 0, 0, 0, 0);
    if (target < todayMidnight) target = new Date(now.getFullYear() + 1, m - 1, d, 0, 0, 0, 0);
    return target;
  }

  function formatCountdown(target) {
    const diffMs = target - new Date();
    // Blank rather than "Vandaag!" here: the badge on the right of the row
    // (see LifeEventsUpcomingCard._render()) already shows that, and
    // showing it a second time on this line too read as duplicated.
    if (diffMs <= 0) return "";
    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return t("countdown_format", { days, hours, minutes, seconds });
  }

  // Splits a stored combined name back into first/last name for the edit
  // form. Names are stored as one string (no separate first/last fields),
  // so this is a heuristic: first word = voornaam, everything else
  // (including Dutch tussenvoegsels like "van der", "de") = achternaam -
  // e.g. "Justin Deitelzweig Senior" -> ("Justin", "Deitelzweig Senior").
  function splitName(fullName) {
    const trimmed = (fullName || "").trim();
    const spaceIdx = trimmed.indexOf(" ");
    if (spaceIdx === -1) return { first: trimmed, last: "" };
    return { first: trimmed.slice(0, spaceIdx), last: trimmed.slice(spaceIdx + 1).trim() };
  }

  function monthOf(iso) {
    if (!iso) return null;
    return parseInt(iso.split("-")[1], 10);
  }

  // Month card's sortable table columns. `dir` is 1 (asc) or -1 (desc);
  // each case decides for itself whether/how it applies dir, so a column
  // like "age" can keep missing values (deceased events have none) sorted
  // last regardless of direction instead of flipping to the top on desc.
  // A function (not a module-level const) since the labels depend on the
  // current language, which can only be resolved once a card actually
  // renders with a `hass` object.
  function monthTableColumns() {
    return { date: t("label_date"), name: t("label_name"), type: t("label_type"), age: t("label_age") };
  }

  function compareByColumn(a, b, column, dir) {
    switch (column) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "type":
        return eventTypeLabel(a.eventType).localeCompare(eventTypeLabel(b.eventType)) * dir;
      case "age": {
        const av = a.eventType === "deceased" ? null : a.age;
        const bv = b.eventType === "deceased" ? null : b.age;
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return (av - bv) * dir;
      }
      case "date":
        return (parseInt(a.date.split("-")[2], 10) - parseInt(b.date.split("-")[2], 10)) * dir;
      default:
        return 0;
    }
  }

  // Shared by all three cards: a read-only "details" popup on the
  // Upcoming/Month cards, and the (editable) add/edit popup on the Manage
  // card, both use the same modal shell/backdrop-close behavior.
  // `backAction`: optional data-action for a "‹" button shown before the
  // title (only the Upcoming/Month details popup uses this, for
  // navigating back up a chain of clicked spouse/parent/child links - see
  // bindDetailsOrEditModal's onBack). Omitted everywhere else, unchanged.
  function modalWrap(title, bodyHtml, closeAction, backAction) {
    return css`
      <div class="bd-modal-backdrop">
        <div class="bd-modal">
          <div class="bd-modal-header">
            ${backAction ? `<button class="bd-icon-btn bd-modal-back-btn" data-action="${backAction}">‹</button>` : ""}
            <span class="bd-modal-title">${title}</span>
            <button class="bd-icon-btn bd-modal-close-btn" data-action="${closeAction}">✕</button>
          </div>
          <div class="bd-modal-body">${bodyHtml}</div>
        </div>
      </div>
    `;
  }

  // Click-outside-to-close: delegates to the modal header's own close
  // button rather than duplicating close logic here.
  //
  // Requires BOTH the mousedown AND the click to land directly on the
  // backdrop, not just the click. A plain `click` check alone also fires
  // when the user starts a text selection drag *inside* the modal (e.g.
  // selecting text in a field near the edge) and the mouseup happens to
  // land on the backdrop's padding - the browser still reports that as a
  // "click" on the backdrop, silently closing the popup mid-selection.
  function bindModalBackdrops(root) {
    root.querySelectorAll(".bd-modal-backdrop").forEach((backdrop) => {
      let downOnBackdrop = false;
      backdrop.addEventListener("mousedown", (e) => {
        downOnBackdrop = e.target === backdrop;
      });
      backdrop.addEventListener("click", (e) => {
        const shouldClose = downOnBackdrop && e.target === backdrop;
        downOnBackdrop = false;
        if (!shouldClose) return;
        const closeBtn = backdrop.querySelector(".bd-modal-close-btn");
        if (closeBtn) closeBtn.click();
      });
    });
  }

  // Read-only "all attributes" view for a single event - used by the
  // Upcoming/Month cards' details popup (Manage card has its own editable
  // form instead).
  // `value` is normally a plain string (escaped as text). Pass
  // `{ __html }` instead when the value needs to embed a navLink() -
  // the caller is responsible for escaping any dynamic text inside it.
  function renderDetailsBody(e, dateFormat, showParentPhone) {
    const rows = [
      [t("label_name"), e.name],
      [t("label_date"), formatDate(e.date, dateFormat)],
      [t("label_type"), eventTypeLabel(e.eventType)],
    ];
    if (e.time) rows.push([t("label_time"), e.time]);
    if (e.eventType !== "deceased" && e.age != null) rows.push([t("label_becomes"), e.age]);
    if (e.eventType === "deceased" && e.dateOfDeath) rows.push([t("label_date_of_death"), formatDate(e.dateOfDeath, dateFormat)]);
    if (e.phoneNumber) rows.push([t("label_phone"), e.phoneNumber]);
    // Only shown when delegation is actually in effect (resolves to
    // someone other than this person) - otherwise the "Telefoon" row above
    // already covers it, no need to repeat "Zelf".
    if (e.primaryContactName && e.primaryPhoneNumber && e.primaryContactName !== e.name) {
      rows.push([
        t("primary_contact_section_title"),
        t("label_primary_contact_value", { name: e.primaryContactName, number: e.primaryPhoneNumber }),
      ]);
    }
    if (e.spouseId) {
      let partnerValue;
      if (e.marriageDate) {
        partnerValue = t("marriage_partner_since", { name: navLink(e.spouseId, e.spouseName), date: formatDate(e.marriageDate, dateFormat) });
      } else if (e.relationshipType === "relationship") {
        // No date-related text at all for an informal relationship - the
        // date genuinely isn't expected to be known, unlike married/
        // registered_partnership.
        partnerValue = t("label_partner_of_bare", { name: navLink(e.spouseId, e.spouseName) });
      } else {
        partnerValue = t("marriage_partner_no_date", { name: navLink(e.spouseId, e.spouseName) });
      }
      rows.push([t(relationshipSectionTitleKey(e.relationshipType)), { __html: partnerValue }]);
    }
    if (e.isCoupleAnniversary) {
      const nickname = e.relationshipType === "married" ? marriageAnniversaryNickname(e.age) : null;
      if (nickname) rows.push([t("label_anniversary_nickname"), nickname]);
    }
    // Two mutually exclusive display modes for linked parents, gated by
    // the card's own show_parent_phone config (off by default): with
    // phone numbers (only parents that actually have one set, unchanged
    // from the original behavior), or - like children below - a plain
    // clickable name list covering every linked parent regardless of
    // whether they have a number.
    if (showParentPhone) {
      (e.parentPhoneNumbers || []).forEach((p) => rows.push([t("label_parent_phone", { name: p.name }), p.phone_number]));
    } else if (e.parentNames && e.parentNames.length) {
      const links = e.parentNames.map((name, i) => navLink((e.parentIds || [])[i], name)).join(", ");
      rows.push([t("parents_section_title"), { __html: links }]);
    }
    if (e.childrenNames && e.childrenNames.length) {
      const links = e.childrenNames.map((name, i) => navLink((e.childrenIds || [])[i], name)).join(", ");
      rows.push([t("children_section_title"), { __html: links }]);
    }
    Object.entries(e.attributes || {}).forEach(([k, v]) => rows.push([k, v]));
    const rowsHtml = rows
      .map(([label, value]) => {
        const valueHtml = value && typeof value === "object" && "__html" in value ? value.__html : escapeAttr(value);
        return css`
          <div class="bd-details-row">
            <div class="bd-details-label">${escapeAttr(label)}</div>
            <div class="bd-details-value">${valueHtml}</div>
          </div>
        `;
      })
      .join("");
    // A full sentence ("X jaar geleden overleden"), not another label/value
    // pair - shown as its own quiet, italic line rather than forced into
    // the two-column row layout above, which would read oddly for a
    // complete sentence.
    const remembranceHtml =
      e.eventType === "deceased" && e.yearsSinceDeath != null
        ? css`<div class="bd-deceased-note">${t("deceased_years_ago", { years: e.yearsSinceDeath })}</div>`
        : "";
    return rowsHtml + remembranceHtml;
  }

  // Renders one input-pair row per custom attribute. Purely DOM-driven
  // (like the import/export textarea) rather than tracked in card state -
  // add/remove-row handlers manipulate #f-attrs-rows directly and
  // saveEventForm() reads the final rows straight from the DOM, so nothing
  // here ever triggers a full _render() that would wipe in-progress typing.
  function attrRowsHtml(attrs) {
    return Object.entries(attrs || {})
      .map(
        ([k, v]) => css`
          <div class="bd-attr-row">
            <input class="f-attr-key" placeholder="${escapeAttr(t("attr_key_placeholder"))}" value="${escapeAttr(k)}" />
            <input class="f-attr-value" placeholder="${escapeAttr(t("attr_value_placeholder"))}" value="${escapeAttr(v)}" />
            <button type="button" class="bd-icon-btn" data-action="remove-attr">✕</button>
          </div>
        `
      )
      .join("");
  }

  function bindAttrRows(root) {
    const container = root.querySelector("#f-attrs-rows");
    if (!container) return;
    container.querySelectorAll('[data-action="remove-attr"]').forEach((btn) =>
      btn.addEventListener("click", () => btn.closest(".bd-attr-row").remove())
    );
  }

  // Custom attributes minus the ones that have their own dedicated required
  // field now (see fixedAttributeFieldsHtml) - otherwise a fixed attribute
  // like "geslacht" would show up twice: once as its own required field,
  // once again as an editable freeform row underneath.
  function freeformAttributesOf(attrs) {
    const fixedKeys = new Set(fixedAttrsCache.map((fa) => fa.key));
    const out = {};
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (!fixedKeys.has(k)) out[k] = v;
    });
    return out;
  }

  // One required field per fixed-attribute definition (see the
  // ensureFixedAttributes block above) - a <select> when `options` is set,
  // otherwise a plain required text input. `data-fixed-key` (not `id`, since
  // attribute names are arbitrary user text and not guaranteed to be valid
  // id characters) is how saveEventForm() reads these back.
  function fixedAttributeFieldsHtml(editing) {
    if (!fixedAttrsCache.length) return "";
    return fixedAttrsCache
      .map((fa) => {
        const value = editing && editing.attributes ? editing.attributes[fa.key] || "" : "";
        if (fa.options && fa.options.length) {
          // Case-insensitive: data entered before this attribute became a
          // fixed dropdown (or imported from elsewhere) may not match an
          // option's exact casing (e.g. stored "Man" vs. a defined option
          // "man") - match loosely so it still pre-fills instead of
          // silently showing blank despite a value actually being stored.
          // Saving again normalizes it to the option's defined casing,
          // same as if the user had picked it by hand.
          const matched = fa.options.find((o) => o.toLowerCase() === value.toLowerCase());
          return css`
            <label>${escapeAttr(fa.key)} *</label>
            <select data-fixed-key="${escapeAttr(fa.key)}">
              <option value="" ${matched ? "" : "selected"} disabled>${t("fixed_attr_choose")}</option>
              ${fa.options
                .map((o) => `<option value="${escapeAttr(o)}" ${o === matched ? "selected" : ""}>${escapeAttr(o)}</option>`)
                .join("")}
            </select>
          `;
        }
        return css`
          <label>${escapeAttr(fa.key)} *</label>
          <input data-fixed-key="${escapeAttr(fa.key)}" value="${escapeAttr(value)}" />
        `;
      })
      .join("");
  }

  // Generic "searchable select": a text input for typing/searching plus a
  // hidden input holding the actual selected value, backed by a plain
  // `[{value, label}]` array filtered by substring match as you type.
  // Shared by the spouse picker and the phone country picker - deliberately
  // NOT a native <select>/<datalist> (both have real cross-browser quirks
  // for "hide/rename the selected option's own display text" and/or
  // in-list text search), in favor of one small, predictable
  // implementation used both places.
  // `option.shortLabel`, if given, is what's written into the search box
  // once selected (e.g. just "+31") instead of the full `label` shown
  // while searching the list (e.g. "Nederland (+31)") - used by the phone
  // country picker to stay compact after a choice is made; omit it (as
  // the spouse picker does) to just show `label` both places.
  // `wrapperStyle`, if given, is applied to the outer `.le-combobox` div
  // (e.g. to size the phone country picker narrower than a full-width
  // field).
  function renderSearchableSelect(idPrefix, options, selectedValue, placeholder, wrapperStyle) {
    const selected = options.find((o) => o.value === selectedValue);
    const displayValue = selected ? (selected.shortLabel != null ? selected.shortLabel : selected.label) : "";
    return css`
      <div class="le-combobox" style="${wrapperStyle || ""}">
        <input type="text" id="${idPrefix}-search" class="le-combobox-input" autocomplete="off" placeholder="${escapeAttr(placeholder)}" value="${escapeAttr(displayValue)}" />
        <input type="hidden" id="${idPrefix}-value" value="${escapeAttr(selectedValue || "")}" />
        <div class="le-combobox-list" id="${idPrefix}-list"></div>
      </div>
    `;
  }

  // `extraOption` (optional {value, label}, or an array of them): always
  // shown pinned at the top of the list regardless of the current filter
  // text - used for the spouse/parent pickers' "+ Nieuw persoon aanmaken"
  // entry (and, for parent slots, also a "geen" clear entry), which must
  // stay reachable even when nothing in the real candidate list matches
  // what's been typed so far.
  function bindSearchableSelect(root, idPrefix, options, onChange, extraOption) {
    const searchInput = root.querySelector(`#${idPrefix}-search`);
    const valueInput = root.querySelector(`#${idPrefix}-value`);
    const listEl = root.querySelector(`#${idPrefix}-list`);
    if (!searchInput || !valueInput || !listEl) return;
    const extraOptions = Array.isArray(extraOption) ? extraOption : extraOption ? [extraOption] : [];
    const allForLookup = [...extraOptions, ...options];

    const renderList = (filterText) => {
      const q = (filterText || "").trim().toLowerCase();
      const matches = (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options).slice(0, 50);
      const extraHtml = extraOptions
        .map((o) => `<div class="le-combobox-option le-combobox-option-pinned" data-value="${escapeAttr(o.value)}">${escapeAttr(o.label)}</div>`)
        .join("");
      const matchesHtml = matches
        .map((o) => `<div class="le-combobox-option" data-value="${escapeAttr(o.value)}">${escapeAttr(o.label)}</div>`)
        .join("");
      listEl.innerHTML = extraHtml + matchesHtml;
      listEl.style.display = matches.length || extraOptions.length ? "" : "none";
      positionList();
    };

    // The list is `position: absolute` inside `.le-combobox` (relative),
    // opening downward via `top: 100%` by default - fine near the top of a
    // form, but a combobox low in a long popup (e.g. the parent pickers,
    // which sit below the marriage section) can have its dropdown clipped
    // by `.bd-modal-body`'s `overflow-y: auto` / `.bd-modal`'s capped
    // `max-height: 85vh`, since an absolutely-positioned descendant is
    // still clipped by an ancestor's overflow even though it's out of
    // normal flow. Flip to open upward when there's more room above than
    // below, and always cap the height to whatever room actually exists
    // (instead of a fixed 220px) so the list is never cut off either way.
    const positionList = () => {
      const scrollAncestor = root.querySelector(".bd-modal-body");
      if (!scrollAncestor) return;
      const boundsRect = scrollAncestor.getBoundingClientRect();
      const inputRect = searchInput.getBoundingClientRect();
      const spaceBelow = boundsRect.bottom - inputRect.bottom;
      const spaceAbove = inputRect.top - boundsRect.top;
      const openUpward = spaceBelow < 150 && spaceAbove > spaceBelow;
      const available = Math.max(120, (openUpward ? spaceAbove : spaceBelow) - 8);
      listEl.style.top = openUpward ? "auto" : "100%";
      listEl.style.bottom = openUpward ? "100%" : "auto";
      listEl.style.marginTop = openUpward ? "0" : "2px";
      listEl.style.marginBottom = openUpward ? "2px" : "0";
      listEl.style.maxHeight = `${Math.min(220, available)}px`;
    };

    const selectOption = (value) => {
      const match = allForLookup.find((o) => o.value === value);
      valueInput.value = value;
      searchInput.value = match ? (match.shortLabel != null ? match.shortLabel : match.label) : "";
      listEl.style.display = "none";
      if (onChange) onChange(value);
    };

    searchInput.addEventListener("focus", () => renderList(""));
    searchInput.addEventListener("input", () => renderList(searchInput.value));
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        listEl.style.display = "none";
      } else if (e.key === "Enter") {
        e.preventDefault();
        const first = listEl.querySelector(".le-combobox-option");
        if (first) selectOption(first.dataset.value);
      }
    });
    // mousedown (not click): fires before the text input's own blur, so a
    // list item can still be selected even though clicking it would
    // otherwise blur the field and hide the list first.
    listEl.addEventListener("mousedown", (e) => {
      const opt = e.target.closest(".le-combobox-option");
      if (!opt) return;
      e.preventDefault();
      selectOption(opt.dataset.value);
    });
    searchInput.addEventListener("blur", () => {
      setTimeout(() => {
        listEl.style.display = "none";
      }, 150);
    });
  }

  // Shared by renderMarriageSection() (initial render) and
  // bindMarriageSection() (rebuilding the same list to bind against) -
  // one source of truth so they can't drift apart. Alphabetical, not
  // hass.states' arbitrary insertion order (which is what made this look
  // "random" before) - localeCompare so accented names (e.g. "Åke",
  // "Émile") sort sensibly too.
  function unmarriedBirthdayCandidates(hass, editingId) {
    return getEvents(hass, ["birthday"])
      .filter((c) => c.entity_id.split(".")[1] !== editingId && !c.spouseId)
      .map((c) => ({ value: c.entity_id.split(".")[1], label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // Parent candidates, unlike spouse candidates: any event type (a
  // deceased grandparent is still a valid parent to link) and no
  // already-linked exclusion (one person can be the parent of several
  // children) - only self and the OTHER parent slot's current pick are
  // excluded, so the two slots can't both point at the same person.
  function parentCandidates(hass, editingId, excludeId) {
    return getEvents(hass, null)
      .filter((c) => {
        const id = c.entity_id.split(".")[1];
        return id !== editingId && id !== excludeId && !c.isCoupleAnniversary;
      })
      .map((c) => ({ value: c.entity_id.split(".")[1], label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  // Shared add/edit form body - used by the Manage card's popup and, when
  // "Bewerken" is clicked, by the Upcoming/Month cards' details popup too.
  // `editing` is null when adding a new event.
  // Married (or was, until the spouse died) -> show read-only info plus a
  // Scheiden action if still living; unmarried and living -> an inline
  // "marry" mini-form (candidate picker, optional inline "create a new
  // person", marriage date, confirm). No marry/divorce action at all for
  // non-birthday-type records (anniversary/deceased) - deliberately: you
  // can't marry someone new *as* your own remembrance entry, and a
  // deceased spouse's own marriage history is shown read-only, never
  // editable from their own record (see LifeEventsManager's
  // _clear_stale_marriage_link for the matching backend rule).
  function renderMarriageSection(editing, editingId, hass) {
    if (!editing) return "";
    if (editing.spouseId) {
      // "Partner van X" phrasing covers both registered_partnership and
      // relationship - the section title above already disambiguates which
      // of the two it is, so only "married" needs its own wording.
      let hint;
      if (editing.marriageDate) {
        hint = t(editing.relationshipType === "married" ? "label_married_to" : "label_partner_of", {
          name: escapeAttr(editing.spouseName || editing.spouseId),
          date: formatDate(editing.marriageDate),
        });
      } else if (editing.relationshipType === "relationship") {
        // No date-related wording at all for an informal relationship.
        hint = t("label_partner_of_bare", { name: escapeAttr(editing.spouseName || editing.spouseId) });
      } else {
        hint = t(editing.relationshipType === "married" ? "label_married_to_no_date" : "label_partner_of_no_date", {
          name: escapeAttr(editing.spouseName || editing.spouseId),
        });
      }
      return css`
        <label>${t(relationshipSectionTitleKey(editing.relationshipType))}</label>
        <div class="le-hint">${hint}</div>
        ${
          !editing.marriageDate
            ? css`
              <label>${t("marriage_date_label")}</label>
              <input id="f-add-marriage-date" type="date" />
              <button type="button" class="bd-btn secondary" data-action="confirm-add-marriage-date" data-spouse-id="${escapeAttr(editing.spouseId)}" data-relationship-type="${editing.relationshipType}">${t("action_add_marriage_date")}</button>
              <div id="marriage-status" class="bd-secondary"></div>
            `
            : ""
        }
        ${
          editing.eventType === "birthday"
            ? css`<button type="button" class="bd-btn secondary" data-action="start-divorce" data-relationship-type="${editing.relationshipType}">${t(editing.relationshipType === "married" ? "action_divorce" : "action_end_partnership")}</button>`
            : ""
        }
      `;
    }
    if (editing.eventType !== "birthday") return "";
    const candidateOptions = unmarriedBirthdayCandidates(hass, editingId);
    return css`
      <label>${t("marriage_section_title")}</label>
      ${renderSearchableSelect("f-spouse", candidateOptions, "", t("marriage_pick_spouse_label"))}
      <div id="f-new-spouse-fields" style="display:none;">
        <label>${t("new_spouse_firstname_label")}</label>
        <input id="f-new-spouse-firstname" />
        <label>${t("new_spouse_lastname_label")}</label>
        <input id="f-new-spouse-lastname" />
        <label>${t("new_spouse_birthdate_label")}</label>
        <input id="f-new-spouse-birthdate" type="date" />
      </div>
      <label>${t("marriage_date_label")}</label>
      <input id="f-marriage-date" type="date" />
      <label>${t("relationship_type_field_label")}</label>
      <select id="f-relationship-type">
        <option value="married" selected>${t("relationship_type_option_married")}</option>
        <option value="registered_partnership">${t("relationship_type_option_registered_partnership")}</option>
        <option value="relationship">${t("relationship_type_option_relationship")}</option>
      </select>
      <button type="button" class="bd-btn secondary" data-action="confirm-marriage">${t("action_confirm_marriage")}</button>
      <div id="marriage-status" class="bd-secondary"></div>
    `;
  }

  // Two independent, optional parent slots - unlike marriage, rendered for
  // ANY event type (a deceased grandparent is still a valid parent to
  // link) and with no confirm button of its own: the picked ids are just
  // part of the normal form payload, applied on the form's own Save button
  // (see readFormFieldsRaw/validateAndBuildPayload) - there's no second
  // record to keep in sync the way marriage's spouse_id is, so parent_ids
  // rides the plain add/update_event path (see manager.py's
  // _validate_parent_ids for the server-side rules: max 2, no self/dup/
  // unknown id, no direct cycle).
  function renderParentSection(editing, editingId, hass) {
    const parentIds = editing ? editing.parentIds || [] : [];
    const slotHtml = [0, 1]
      .map((i) => {
        const otherValue = parentIds[1 - i] || null;
        const candidateOptions = parentCandidates(hass, editingId, otherValue);
        return css`
          <label>${t(i === 0 ? "parent_1_pick_label" : "parent_2_pick_label")}</label>
          ${renderSearchableSelect(`f-parent-${i}`, candidateOptions, parentIds[i] || "", t(i === 0 ? "parent_1_pick_label" : "parent_2_pick_label"))}
          <div id="f-new-parent-${i}-fields" style="display:none;">
            <label>${t("new_parent_firstname_label")}</label>
            <input id="f-new-parent-${i}-firstname" />
            <label>${t("new_parent_lastname_label")}</label>
            <input id="f-new-parent-${i}-lastname" />
            <label>${t("new_parent_birthdate_label")}</label>
            <input id="f-new-parent-${i}-birthdate" type="date" />
          </div>
        `;
      })
      .join("");
    return css`
      <label>${t("parent_section_title")}</label>
      ${slotHtml}
    `;
  }

  // Candidates for "primary contact" delegation: the linked spouse/partner
  // and/or linked parent(s) - the same people already shown via spouseId/
  // parentIds on `editing`, no separate lookup needed. Absent entirely
  // (returns []) when there's nobody to delegate to.
  function primaryContactCandidates(editing) {
    const candidates = [];
    if (editing.spouseId) {
      candidates.push({ value: editing.spouseId, label: editing.spouseName || editing.spouseId });
    }
    (editing.parentIds || []).forEach((id, i) => {
      const label = (editing.parentNames || [])[i] || id;
      candidates.push({ value: id, label });
    });
    return candidates;
  }

  // A row of clickable buttons ("Zelf" + one per linked spouse/parent) that
  // sets a hidden #f-primary-contact-id input - the "handige UI knop" the
  // feature was asked for, rather than a dropdown, since there are at most
  // 3-4 candidates. Only rendered when there's at least one real candidate
  // (nothing to delegate to otherwise). The picked value rides the normal
  // form payload (see readFormFieldsRaw/validateAndBuildPayload), same
  // spirit as parent_ids - no service call of its own.
  function renderPrimaryContactSection(editing) {
    if (!editing) return "";
    const candidates = primaryContactCandidates(editing);
    if (!candidates.length) return "";
    const current = editing.primaryContactId || "";
    const options = [{ value: "", label: t("primary_contact_self_option") }, ...candidates];
    const optionsHtml = options
      .map(
        (opt) => css`
          <button type="button" class="le-contact-option${opt.value === current ? " active" : ""}" data-value="${escapeAttr(opt.value)}">${escapeAttr(opt.label)}</button>
        `
      )
      .join("");
    return css`
      <label>${t("primary_contact_section_title")}</label>
      <div class="le-hint">${t("primary_contact_hint")}</div>
      <div class="le-contact-options">${optionsHtml}</div>
      <input type="hidden" id="f-primary-contact-id" value="${escapeAttr(current)}" />
    `;
  }

  // Binds renderPrimaryContactSection()'s buttons - clicking one just
  // updates the hidden input + active-class highlighting, no service call.
  function bindPrimaryContactSection(root) {
    const hidden = root.querySelector("#f-primary-contact-id");
    if (!hidden) return;
    root.querySelectorAll(".le-contact-option").forEach((btn) => {
      btn.addEventListener("click", () => {
        hidden.value = btn.dataset.value || "";
        root.querySelectorAll(".le-contact-option").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });
  }

  function renderEventFormBody(editing, editingId, confirmDelete, hass) {
    const nameParts = splitName(editing ? editing.name : "");
    return css`
      <div class="bd-form">
        <label>${t("field_firstname")}</label>
        <input id="f-firstname" value="${escapeAttr(nameParts.first)}" />
        <label>${t("field_lastname")}</label>
        <input id="f-lastname" value="${escapeAttr(nameParts.last)}" />
        <label>${t("label_type")}</label>
        <select id="f-type">
          ${["birthday", "anniversary", "deceased"]
            .map(
              (ty) =>
                `<option value="${ty}" ${editing && editing.eventType === ty ? "selected" : ""}>${eventTypeLabel(ty)}</option>`
            )
            .join("")}
        </select>
        <label>${t("label_date")}</label>
        <input id="f-date" type="date" value="${editing ? editing.date : ""}" />
        <label>${t("field_birth_time")}</label>
        <input id="f-time" type="time" value="${editing && editing.time ? editing.time : ""}" />
        <label>${t("field_date_of_death")}</label>
        <input id="f-date-death" type="date" value="${editing && editing.dateOfDeath ? editing.dateOfDeath : ""}" />
        <label>${t("field_icon")}</label>
        <input id="f-icon" value="${editing && editing.icon ? editing.icon : ""}" />
        <label>${t("field_phone")}</label>
        <div style="display:flex; gap:8px;">
          ${(() => {
            const phone = fromE164(editing ? editing.phoneNumber : "");
            return css`
              ${renderSearchableSelect("f-phone-country", phoneCountryOptions(), phone.iso2, t("phone_country_search_placeholder"), "flex:0 0 100px; width:100px;")}
              <input id="f-phone-local" style="flex:1; min-width:0;" placeholder="${escapeAttr(t("phone_placeholder"))}" value="${phone.local}" />
            `;
          })()}
        </div>
        ${renderMarriageSection(editing, editingId, hass)}
        ${renderParentSection(editing, editingId, hass)}
        ${renderPrimaryContactSection(editing)}
        ${fixedAttributeFieldsHtml(editing)}
        <label>${t("field_custom_attrs")}</label>
        <div id="f-attrs-rows">${attrRowsHtml(freeformAttributesOf(editing ? editing.attributes : {}))}</div>
        <button type="button" class="bd-btn secondary" data-action="add-attr">${t("action_add_attr")}</button>
        ${
          editing && confirmDelete
            ? css`
              <div class="bd-confirm">
                <span>${t("confirm_delete_question")}</span>
                <div class="bd-actions">
                  <button class="bd-btn danger" data-action="delete-confirm" data-id="${editingId}">${t("action_delete_confirm")}</button>
                  <button class="bd-btn secondary" data-action="delete-cancel">${t("action_cancel")}</button>
                </div>
              </div>
            `
            : css`
              <div class="bd-actions">
                <button class="bd-btn" data-action="save">${editing ? t("action_save") : t("action_add")}</button>
                <button class="bd-btn secondary" data-action="cancel">${t("action_cancel")}</button>
                <button type="button" class="bd-btn secondary" data-action="edit-as-yaml">${t("action_edit_yaml")}</button>
                ${editing ? `<button class="bd-btn danger" data-action="delete" data-id="${editingId}">${t("action_delete")}</button>` : ""}
              </div>
            `
        }
      </div>
    `;
  }

  // Read-only view for an auto-created couple's-anniversary entity (see
  // isCoupleAnniversary in getEvents()) - no Save/Edit-as-YAML, since
  // editing its date directly here would silently desync it from the two
  // partners' own marriage_date (the "official" way to change it is
  // re-linking via either partner's own edit form - see the "add date
  // later" flow in bindMarriageSection). Delete is the only action, and
  // symmetrically unlinks both partners (see manager.py's
  // async_delete_event). Reuses the same delete-confirm data-actions as
  // renderEventFormBody, so bindEventFormEvents needs no changes - it
  // already no-ops on missing save/edit-as-yaml buttons.
  function renderAnniversaryDetailsBody(editing, editingId, confirmDelete, dateFormat) {
    return css`
      <div class="bd-form">
        ${renderDetailsBody(editing, dateFormat)}
        ${
          confirmDelete
            ? css`
              <div class="bd-confirm">
                <span>${t("confirm_delete_question")}</span>
                <div class="bd-actions">
                  <button class="bd-btn danger" data-action="delete-confirm" data-id="${editingId}">${t("action_delete_confirm")}</button>
                  <button class="bd-btn secondary" data-action="delete-cancel">${t("action_cancel")}</button>
                </div>
              </div>
            `
            : css`
              <div class="bd-actions">
                <button class="bd-btn secondary" data-action="cancel">${t("action_cancel")}</button>
                <button class="bd-btn danger" data-action="delete" data-id="${editingId}">${t("action_delete")}</button>
              </div>
            `
        }
      </div>
    `;
  }

  // YAML-lite mirror of the same form, toggled via the "edit-as-yaml"
  // button above. Deliberately NOT a general YAML parser/dumper (no
  // external dep - see the file header) - a fixed, schema-specific set of
  // technical field names (English, not run through t()), the same
  // "raw/technical, not localized" contract HA's own "Edit in YAML" uses
  // elsewhere (entities, automations, ...). `fields` is the shape produced
  // by readFormFieldsRaw()/parseYamlLite() below.
  function renderYamlFormBody(fields, editingId) {
    return css`
      <div class="bd-form">
        <div class="le-hint">${t("yaml_edit_hint")}</div>
        <textarea id="f-yaml" rows="14" spellcheck="false">${escapeAttr(fieldsToYamlLite(fields))}</textarea>
        <div class="bd-actions">
          <button class="bd-btn" data-action="save">${editingId ? t("action_save") : t("action_add")}</button>
          <button type="button" class="bd-btn secondary" data-action="exit-yaml">${t("action_edit_form")}</button>
          <button class="bd-btn secondary" data-action="cancel">${t("action_cancel")}</button>
        </div>
      </div>
    `;
  }

  // Quotes a value only when needed to round-trip safely (leading/trailing
  // whitespace, empty, or containing ":"/"#" - which would otherwise be
  // misread as a new key or a comment by parseYamlLite below); everything
  // else is emitted bare for readability, matching how real YAML dumpers
  // behave and what HA users already expect from "Edit in YAML".
  function yamlLiteValue(v) {
    const s = v == null ? "" : String(v);
    return s === "" || s !== s.trim() || /[:#]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s;
  }

  function fieldsToYamlLite(fields) {
    const lines = [
      `firstname: ${yamlLiteValue(fields.firstName)}`,
      `lastname: ${yamlLiteValue(fields.lastName)}`,
      `type: ${yamlLiteValue(fields.eventType)}`,
      `date: ${yamlLiteValue(fields.date)}`,
      `time: ${yamlLiteValue(fields.time)}`,
      `date_of_death: ${yamlLiteValue(fields.dateOfDeath)}`,
      `icon: ${yamlLiteValue(fields.icon)}`,
      `phone: ${yamlLiteValue(fields.phoneNumber)}`,
      `parent_ids: ${yamlLiteValue((fields.parentIds || []).join(", "))}`,
      `primary_contact_id: ${yamlLiteValue(fields.primaryContactId)}`,
    ];
    const attrKeys = Object.keys(fields.attributes || {});
    if (!attrKeys.length) {
      lines.push("attributes: {}");
    } else {
      lines.push("attributes:");
      attrKeys.forEach((k) => lines.push(`  ${yamlLiteValue(k)}: ${yamlLiteValue(fields.attributes[k])}`));
    }
    return lines.join("\n");
  }

  function unquoteYamlLiteValue(raw) {
    const s = raw.trim();
    if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) return s.slice(1, -1).replace(/\\"/g, '"');
    return s;
  }

  // Reverse of fieldsToYamlLite(). Deliberately lenient (no throwing on
  // malformed input): a line without a ":" is skipped, an unrecognized
  // top-level key is ignored, and whatever ends up missing/invalid is
  // caught afterwards by the same validateAndBuildPayload() every other
  // save path goes through - so a typo here surfaces as the normal "Voornaam
  // en datum zijn verplicht" message, not a crash.
  function parseYamlLite(text) {
    const fields = { firstName: "", lastName: "", eventType: "birthday", date: "", time: "", dateOfDeath: "", icon: "", phoneNumber: "", parentIds: [], primaryContactId: "", attributes: {} };
    const KEY_MAP = { firstname: "firstName", lastname: "lastName", type: "eventType", date: "date", time: "time", date_of_death: "dateOfDeath", icon: "icon", phone: "phoneNumber" };
    let inAttributes = false;
    for (const rawLine of (text || "").split("\n")) {
      if (!rawLine.trim()) continue;
      const indented = /^\s/.test(rawLine);
      const colonIdx = rawLine.indexOf(":");
      if (colonIdx === -1) continue;
      const key = rawLine.slice(0, colonIdx).trim();
      const value = unquoteYamlLiteValue(rawLine.slice(colonIdx + 1));
      if (!indented) {
        inAttributes = key === "attributes";
        if (inAttributes) continue;
        if (key === "parent_ids") {
          fields.parentIds = value
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v);
          continue;
        }
        if (key === "primary_contact_id") {
          fields.primaryContactId = value.trim();
          continue;
        }
        const fieldName = KEY_MAP[key];
        if (fieldName) fields[fieldName] = value;
      } else if (inAttributes && key) {
        fields.attributes[key] = value;
      }
    }
    if (!["birthday", "anniversary", "deceased"].includes(fields.eventType)) fields.eventType = "birthday";
    return fields;
  }

  // Adapter so the parsed/raw `fields` shape can be fed straight back into
  // renderEventFormBody(), which expects an `editing`-shaped object (the
  // same shape getEvents() produces for a real entity).
  function fieldsToEditingLike(fields) {
    return {
      name: fields.lastName ? `${fields.firstName} ${fields.lastName}` : fields.firstName,
      date: fields.date,
      time: fields.time,
      dateOfDeath: fields.dateOfDeath,
      icon: fields.icon,
      phoneNumber: fields.phoneNumber,
      eventType: fields.eventType,
      parentIds: fields.parentIds || [],
      primaryContactId: fields.primaryContactId || "",
      attributes: fields.attributes,
    };
  }

  // Reads the current, possibly in-progress form values straight from the
  // DOM into the plain "fields" shape shared with the YAML path
  // (parseYamlLite() below produces the same shape from text instead of
  // DOM nodes) - neither validated nor turned into a service payload yet.
  function readFormFieldsRaw(root) {
    const firstName = root.querySelector("#f-firstname").value.trim();
    const lastName = root.querySelector("#f-lastname").value.trim();
    const eventType = root.querySelector("#f-type").value;
    const date = root.querySelector("#f-date").value;
    const time = root.querySelector("#f-time").value;
    const dateOfDeath = root.querySelector("#f-date-death").value;
    const icon = root.querySelector("#f-icon").value.trim();
    const phoneCountry = root.querySelector("#f-phone-country-value").value;
    const phoneLocal = root.querySelector("#f-phone-local").value.trim();
    // Only meaningful for birthday/anniversary; clears any previously set
    // number if the type was switched to deceased or the field was emptied.
    const phoneNumber = PHONE_EVENT_TYPES.includes(eventType) && phoneLocal ? toE164(phoneLocal, phoneCountry) : "";

    const attributes = {};
    root.querySelectorAll("[data-fixed-key]").forEach((field) => {
      attributes[field.dataset.fixedKey] = field.value.trim();
    });
    root.querySelectorAll("#f-attrs-rows .bd-attr-row").forEach((row) => {
      const key = row.querySelector(".f-attr-key").value.trim();
      const value = row.querySelector(".f-attr-value").value.trim();
      if (key) attributes[key] = value;
    });

    const parentIds = [0, 1]
      .map((i) => {
        const el = root.querySelector(`#f-parent-${i}-value`);
        return el ? el.value : "";
      })
      .filter((v) => v);

    const primaryContactIdEl = root.querySelector("#f-primary-contact-id");
    const primaryContactId = primaryContactIdEl ? primaryContactIdEl.value : "";

    return { firstName, lastName, eventType, date, time, dateOfDeath, icon, phoneNumber, parentIds, primaryContactId, attributes };
  }

  // Validates a `fields` object (from either readFormFieldsRaw() or
  // parseYamlLite()) and, if valid, builds the add_event/update_event
  // service payload. Shared by both the normal-form and YAML save paths so
  // neither can drift from the other's rules.
  function validateAndBuildPayload(fields) {
    if (!fields.firstName || !fields.date) {
      return { ok: false, message: t("validation_required") };
    }
    for (const fa of fixedAttrsCache) {
      const value = fields.attributes[fa.key] || "";
      if (!value) {
        return { ok: false, message: t("validation_required_fixed", { key: fa.key }) };
      }
      if (fa.options && fa.options.length) {
        // Case-insensitive, same as the dropdown's own pre-fill (see
        // fixedAttributeFieldsHtml) - matters here specifically because the
        // YAML path bypasses the <select> element that would otherwise
        // make an invalid value impossible to enter in the first place.
        const matched = fa.options.find((o) => o.toLowerCase() === value.toLowerCase());
        if (!matched) {
          return { ok: false, message: t("validation_invalid_fixed_option", { key: fa.key }) };
        }
        fields.attributes[fa.key] = matched;
      }
    }

    // Kept as one combined name everywhere except this form (storage,
    // entity naming/slugs, search, CSV/JSON export, ...) - only input/
    // editing is split into two fields for convenience (e.g. someone
    // changing their surname after marriage).
    const name = fields.lastName ? `${fields.firstName} ${fields.lastName}` : fields.firstName;
    const data = { name, event_type: fields.eventType, date: fields.date };
    if (fields.icon) data.icon = fields.icon;
    if (fields.eventType === "deceased" && fields.dateOfDeath) data.date_of_death = fields.dateOfDeath;
    data.phone_number = fields.phoneNumber || "";
    // Always included (even "" / {}), so clearing a field or removing every
    // attribute row actually clears the previously stored value - both
    // update_event fields are replaced wholesale, not merged (see
    // manager.py).
    data.time = fields.time || "";
    // Always included (even []), so clearing a parent slot actually clears
    // it - same "replaced wholesale, not merged" rule as time/attributes
    // above (see manager.py's async_update_event merge dict).
    data.parent_ids = fields.parentIds || [];
    // Always included (even ""), so picking "Zelf" actually clears a
    // previously set delegation - same wholesale-replace rule as above.
    data.primary_contact_id = fields.primaryContactId || "";
    data.attributes = fields.attributes;
    return { ok: true, data };
  }

  async function performSave(hass, editingId, fields) {
    const built = validateAndBuildPayload(fields);
    if (!built.ok) return built;
    if (editingId) {
      await callService(hass, "update_event", { event_id: editingId, ...built.data });
    } else {
      await callService(hass, "add_event", built.data);
    }
    return { ok: true };
  }

  async function saveEventForm(root, hass, editingId) {
    const fields = readFormFieldsRaw(root);
    if (fields.parentIds.includes("__new__")) {
      const resolved = await resolveNewParentSlots(root, hass);
      if (!resolved) return { ok: false, message: t("validation_required") };
      fields.parentIds = resolved;
    }
    return performSave(hass, editingId, fields);
  }

  async function saveEventFormYaml(root, hass, editingId) {
    return performSave(hass, editingId, parseYamlLite(root.querySelector("#f-yaml").value));
  }

  // Binds every control inside renderEventFormBody()'s markup. `ctx`:
  //   hass, editingId
  //   onSave(result)       - result is { ok, message? } from saveEventForm()
  //   onCancel()
  //   onDeleteRequest()    - "Verwijderen" clicked, show the confirm step
  //   onDeleteCancel()
  //   onDeleteConfirm()    - delete_event already called, entity is gone
  //   onRefresh()          - a marry/divorce action completed; re-render so
  //                          the form reflects the (soon-to-arrive) new
  //                          hass state, WITHOUT closing the popup the way
  //                          onSave/onDeleteConfirm do
  function bindEventFormEvents(root, ctx) {
    root.querySelectorAll('[data-action="cancel"]').forEach((btn) => btn.addEventListener("click", ctx.onCancel));
    const saveBtn = root.querySelector('[data-action="save"]');
    if (saveBtn)
      saveBtn.addEventListener("click", async () => {
        const isYaml = !!root.querySelector("#f-yaml");
        const result = isYaml
          ? await saveEventFormYaml(root, ctx.hass, ctx.editingId)
          : await saveEventForm(root, ctx.hass, ctx.editingId);
        ctx.onSave(result);
      });
    // Delete is a two-step confirm rendered inline in the popup, not the
    // browser's native confirm() (looks out of place in the Companion
    // app / kiosk dashboards and isn't themed like the rest of the UI).
    const deleteBtn = root.querySelector('[data-action="delete"]');
    if (deleteBtn) deleteBtn.addEventListener("click", ctx.onDeleteRequest);
    const deleteCancelBtn = root.querySelector('[data-action="delete-cancel"]');
    if (deleteCancelBtn) deleteCancelBtn.addEventListener("click", ctx.onDeleteCancel);
    const deleteConfirmBtn = root.querySelector('[data-action="delete-confirm"]');
    if (deleteConfirmBtn)
      deleteConfirmBtn.addEventListener("click", async () => {
        await callService(ctx.hass, "delete_event", { event_id: deleteConfirmBtn.dataset.id });
        ctx.onDeleteConfirm();
      });

    bindAttrRows(root);
    const addAttrBtn = root.querySelector('[data-action="add-attr"]');
    if (addAttrBtn)
      addAttrBtn.addEventListener("click", () => {
        // Direct DOM append, not a full re-render: this popup can be
        // mid-edit (name/date/etc. typed but not saved yet), and rebuilding
        // would wipe all of that the same way the earlier typing bugs did.
        const container = root.querySelector("#f-attrs-rows");
        if (!container) return;
        container.insertAdjacentHTML("beforeend", attrRowsHtml({ "": "" }));
        const newRow = container.lastElementChild;
        const removeBtn = newRow.querySelector('[data-action="remove-attr"]');
        if (removeBtn) removeBtn.addEventListener("click", () => newRow.remove());
      });

    // Both directions swap only the `.bd-form` wrapper (via outerHTML, then
    // rebind everything against the fresh nodes) rather than going through
    // a card's own _render() - same reasoning as add-attr above: this modal
    // can be mid-edit, and a full re-render would wipe unrelated in-flight
    // state (e.g. the modal's own detailsId bookkeeping) the same way the
    // earlier typing bugs did. `.bd-form` is always the sole child of
    // `.bd-modal-body` (see renderDetailsOrEditModal/modalWrap), so this
    // never touches the modal header/title.
    const editAsYamlBtn = root.querySelector('[data-action="edit-as-yaml"]');
    if (editAsYamlBtn)
      editAsYamlBtn.addEventListener("click", () => {
        const formEl = root.querySelector(".bd-form");
        if (!formEl) return;
        const fields = readFormFieldsRaw(root);
        formEl.outerHTML = renderYamlFormBody(fields, ctx.editingId);
        bindEventFormEvents(root, ctx);
        const ta = root.querySelector("#f-yaml");
        if (ta) ta.focus();
      });
    const exitYamlBtn = root.querySelector('[data-action="exit-yaml"]');
    if (exitYamlBtn)
      exitYamlBtn.addEventListener("click", () => {
        const formEl = root.querySelector(".bd-form");
        if (!formEl) return;
        const parsed = parseYamlLite(root.querySelector("#f-yaml").value);
        formEl.outerHTML = renderEventFormBody(fieldsToEditingLike(parsed), ctx.editingId, false, ctx.hass);
        bindEventFormEvents(root, ctx);
      });

    bindMarriageSection(root, ctx);
    bindParentSection(root, ctx);
    bindPrimaryContactSection(root);
    bindSearchableSelect(root, "f-phone-country", phoneCountryOptions(), null);
  }

  // Marry/divorce actions for renderMarriageSection()'s markup - part of
  // bindEventFormEvents (called from there), split out only for
  // readability given how much is already in that function.
  function bindMarriageSection(root, ctx) {
    const spouseValueInput = root.querySelector("#f-spouse-value");
    if (spouseValueInput) {
      bindSearchableSelect(
        root,
        "f-spouse",
        unmarriedBirthdayCandidates(ctx.hass, ctx.editingId),
        (value) => {
          const newFields = root.querySelector("#f-new-spouse-fields");
          if (newFields) newFields.style.display = value === "__new__" ? "" : "none";
        },
        { value: "__new__", label: t("marriage_new_person_option") }
      );
    }

    const relationshipTypeSelect = root.querySelector("#f-relationship-type");
    const confirmMarriageBtn = root.querySelector('[data-action="confirm-marriage"]');
    if (relationshipTypeSelect && confirmMarriageBtn) {
      relationshipTypeSelect.addEventListener("change", () => {
        confirmMarriageBtn.textContent = t(relationshipTypeSelect.value === "married" ? "action_confirm_marriage" : "action_confirm_partnership");
      });
    }
    if (confirmMarriageBtn)
      confirmMarriageBtn.addEventListener("click", async () => {
        const statusEl = root.querySelector("#marriage-status");
        let spouseId = spouseValueInput ? spouseValueInput.value : "";
        if (!spouseId) {
          if (statusEl) statusEl.textContent = t("validation_required");
          return;
        }
        if (spouseId === "__new__") {
          const firstName = root.querySelector("#f-new-spouse-firstname").value.trim();
          const birthDate = root.querySelector("#f-new-spouse-birthdate").value;
          if (!firstName || !birthDate) {
            if (statusEl) statusEl.textContent = t("validation_required");
            return;
          }
          const lastName = root.querySelector("#f-new-spouse-lastname").value.trim();
          const name = lastName ? `${firstName} ${lastName}` : firstName;
          // wantsResponse=true: add_event returns { id }, needed immediately
          // below to link the marriage - unlike a normal add via the form,
          // this can't just wait for the next hass tick to find it.
          const added = await callService(ctx.hass, "add_event", { name, date: birthDate }, true);
          spouseId = added && added.id;
          if (!spouseId) {
            if (statusEl) statusEl.textContent = t("validation_required");
            return;
          }
        }
        const relationshipType = relationshipTypeSelect ? relationshipTypeSelect.value : "married";
        const marriageDate = root.querySelector("#f-marriage-date").value;
        const doLink = async () => {
          const payload = { event_id: ctx.editingId, spouse_id: spouseId, relationship_type: relationshipType };
          if (marriageDate) payload.marriage_date = marriageDate;
          await callService(ctx.hass, "link_marriage", payload);
          ctx.onRefresh();
        };
        if (marriageDate) {
          await doLink();
          return;
        }
        // No date given - a real, common case (a couple already together
        // before this integration existed) - confirm that's intentional
        // rather than silently linking with no anniversary date.
        confirmMarriageBtn.outerHTML = css`
          <div class="bd-confirm">
            <span>${t("confirm_no_marriage_date_question")}</span>
            <div class="bd-actions">
              <button type="button" class="bd-btn" data-action="confirm-marriage-no-date">${t("action_confirm_no_date")}</button>
              <button type="button" class="bd-btn secondary" data-action="cancel-marriage-no-date">${t("action_cancel")}</button>
            </div>
          </div>
        `;
        const confirmNoDateBtn = root.querySelector('[data-action="confirm-marriage-no-date"]');
        if (confirmNoDateBtn) confirmNoDateBtn.addEventListener("click", doLink);
        const cancelNoDateBtn = root.querySelector('[data-action="cancel-marriage-no-date"]');
        if (cancelNoDateBtn) cancelNoDateBtn.addEventListener("click", () => ctx.onRefresh());
      });

    const addMarriageDateBtn = root.querySelector('[data-action="confirm-add-marriage-date"]');
    if (addMarriageDateBtn)
      addMarriageDateBtn.addEventListener("click", async () => {
        const statusEl = root.querySelector("#marriage-status");
        const newDate = root.querySelector("#f-add-marriage-date").value;
        if (!newDate) {
          if (statusEl) statusEl.textContent = t("validation_required");
          return;
        }
        // marriage_date is deliberately not editable via plain
        // update_event (see const.py) - re-linking the same pair is how an
        // initially-unknown date gets filled in later.
        await callService(ctx.hass, "link_marriage", {
          event_id: ctx.editingId,
          spouse_id: addMarriageDateBtn.dataset.spouseId,
          marriage_date: newDate,
          relationship_type: addMarriageDateBtn.dataset.relationshipType || "married",
        });
        ctx.onRefresh();
      });

    const startDivorceBtn = root.querySelector('[data-action="start-divorce"]');
    if (startDivorceBtn)
      startDivorceBtn.addEventListener("click", () => {
        // Same inline two-step confirm pattern as delete (see
        // renderEventFormBody's confirmDelete branch) - not the browser's
        // native confirm(). DOM-only swap of just this button, not a
        // re-render, for the same reason add-attr/edit-as-yaml are DOM-only.
        const married = startDivorceBtn.dataset.relationshipType === "married";
        startDivorceBtn.outerHTML = css`
          <div class="bd-confirm">
            <span>${t(married ? "confirm_divorce_question" : "confirm_end_partnership_question")}</span>
            <div class="bd-actions">
              <button type="button" class="bd-btn danger" data-action="confirm-divorce">${t(married ? "action_divorce_confirm" : "action_end_partnership_confirm")}</button>
              <button type="button" class="bd-btn secondary" data-action="cancel-divorce">${t("action_cancel")}</button>
            </div>
          </div>
        `;
        const confirmDivorceBtn = root.querySelector('[data-action="confirm-divorce"]');
        if (confirmDivorceBtn)
          confirmDivorceBtn.addEventListener("click", async () => {
            await callService(ctx.hass, "unlink_marriage", { event_id: ctx.editingId });
            ctx.onRefresh();
          });
        const cancelDivorceBtn = root.querySelector('[data-action="cancel-divorce"]');
        if (cancelDivorceBtn) cancelDivorceBtn.addEventListener("click", () => ctx.onRefresh());
      });
  }

  // Binds both parent-slot comboboxes for renderParentSection()'s markup.
  // No confirm button/service call of its own (unlike marriage) - a picked
  // id is just written into the slot's hidden value input, read later by
  // readFormFieldsRaw() as part of the normal form payload. The only
  // service call this ever triggers is the same "create a new person
  // inline" add_event used by the spouse picker's "__new__" option.
  function bindParentSection(root, ctx) {
    [0, 1].forEach((i) => {
      const valueInput = root.querySelector(`#f-parent-${i}-value`);
      if (!valueInput) return;
      const otherValueInput = root.querySelector(`#f-parent-${1 - i}-value`);
      bindSearchableSelect(
        root,
        `f-parent-${i}`,
        parentCandidates(ctx.hass, ctx.editingId, otherValueInput ? otherValueInput.value : null),
        (value) => {
          const newFields = root.querySelector(`#f-new-parent-${i}-fields`);
          if (newFields) newFields.style.display = value === "__new__" ? "" : "none";
        },
        [
          { value: "", label: t("parent_none_option") },
          { value: "__new__", label: t("marriage_new_person_option") },
        ]
      );
    });
  }

  // Resolves both parent slots straight from the DOM into a final list of
  // real event ids, creating a new person first for any slot still holding
  // the "__new__" sentinel - called from saveEventForm before the normal
  // validate/save path, since parent_ids (unlike marriage's spouse_id) is
  // just a plain field in that payload, not its own dedicated link
  // service. Reads slots directly (not fields.parentIds, which has
  // already dropped empty slots and so can't tell two simultaneous
  // "__new__" slots apart) - unambiguous per-slot resolution. Returns null
  // (payload unusable) if a "__new__" slot is missing its required inline
  // fields.
  async function resolveNewParentSlots(root, hass) {
    const resolved = [];
    for (const i of [0, 1]) {
      const valueInput = root.querySelector(`#f-parent-${i}-value`);
      if (!valueInput) continue;
      let value = valueInput.value;
      if (value === "__new__") {
        const firstName = root.querySelector(`#f-new-parent-${i}-firstname`).value.trim();
        const birthDate = root.querySelector(`#f-new-parent-${i}-birthdate`).value;
        if (!firstName || !birthDate) return null;
        const lastName = root.querySelector(`#f-new-parent-${i}-lastname`).value.trim();
        const name = lastName ? `${firstName} ${lastName}` : firstName;
        const added = await callService(hass, "add_event", { name, date: birthDate }, true);
        if (!added || !added.id) return null;
        value = added.id;
      }
      if (value) resolved.push(value);
    }
    return resolved;
  }

  // Shared by the Upcoming and Month cards: a details popup that can flip
  // into the same edit form the Manage card uses, via a "Bewerken" button.
  // `detailsEvent` is the resolved event object (or null - no popup); the
  // returned HTML already includes the modal wrapper.
  // `canGoBack`: true when there's a details-navigation history to return
  // to (see the Upcoming/Month cards' _detailsHistory) - shows a "‹" back
  // button in the modal header, only in read-only mode (not while editing
  // or on a couple's-anniversary entity, which has no incoming nav links
  // pointing at it - see navLink's only callers).
  function renderDetailsOrEditModal(detailsEvent, formMode, confirmDelete, dateFormat, hass, showParentPhone, canGoBack) {
    if (!detailsEvent) return "";
    const editingId = detailsEvent.entity_id.split(".")[1];
    const title = css`
      <ha-icon icon="${detailsEvent.icon || EVENT_TYPE_ICONS[detailsEvent.eventType]}"></ha-icon>
      <span>${escapeAttr(detailsEvent.name)}</span>
    `;
    // A couple's-anniversary entity has no separate "edit" mode - its own
    // view already includes a delete action, so no "Bewerken" escape
    // hatch into a full editable date field exists here either (mirrors
    // the same restriction in the Manage card's popup - see
    // renderAnniversaryDetailsBody for why: editing the date directly
    // would desync it from the two partners' own marriage_date).
    if (detailsEvent.isCoupleAnniversary) {
      const body = renderAnniversaryDetailsBody(detailsEvent, editingId, confirmDelete, dateFormat);
      return modalWrap(title, body, "cancel");
    }
    const body = formMode
      ? renderEventFormBody(detailsEvent, editingId, confirmDelete, hass)
      : css`
          ${renderDetailsBody(detailsEvent, dateFormat, showParentPhone)}
          <button type="button" class="bd-btn bd-details-edit-btn" data-action="start-edit">
            <ha-icon icon="mdi:pencil"></ha-icon> ${t("action_edit")}
          </button>
        `;
    return modalWrap(title, body, formMode ? "cancel" : "close-details", !formMode && canGoBack ? "details-back" : null);
  }

  // ctx: hass, detailsId, formMode, isCoupleAnniversary, onStartEdit(),
  // onClose(), onSave(result), onCancelEdit(), onDeleteRequest(),
  // onDeleteCancel(), onDeleteConfirm(), onRefresh(), onNavigate(id),
  // onBack()
  function bindDetailsOrEditModal(root, ctx) {
    root.querySelectorAll('[data-action="close-details"]').forEach((btn) => btn.addEventListener("click", ctx.onClose));
    const startEditBtn = root.querySelector('[data-action="start-edit"]');
    if (startEditBtn) startEditBtn.addEventListener("click", ctx.onStartEdit);
    const backBtn = root.querySelector('[data-action="details-back"]');
    if (backBtn && ctx.onBack) backBtn.addEventListener("click", ctx.onBack);
    if (ctx.onNavigate) {
      root.querySelectorAll(".le-nav-link").forEach((link) =>
        link.addEventListener("click", () => ctx.onNavigate(link.dataset.navId))
      );
    }
    // A couple's-anniversary entity's read-only view already includes
    // cancel/delete actions (see renderAnniversaryDetailsBody) with no
    // separate formMode at all - bind the same handlers regardless.
    if (ctx.formMode || ctx.isCoupleAnniversary) {
      bindEventFormEvents(root, {
        hass: ctx.hass,
        editingId: ctx.detailsId,
        onSave: ctx.onSave,
        // A couple's-anniversary popup has no read-only view to fall back
        // to (unlike a normal person's "exit edit mode") - cancel/✕ must
        // fully close it, same as onClose, not just flip formMode off.
        onCancel: ctx.isCoupleAnniversary ? ctx.onClose : ctx.onCancelEdit,
        onDeleteRequest: ctx.onDeleteRequest,
        onDeleteCancel: ctx.onDeleteCancel,
        onDeleteConfirm: ctx.onDeleteConfirm,
        onRefresh: ctx.onRefresh,
      });
    }
  }

  async function callService(hass, service, data, wantsResponse) {
    if (wantsResponse) {
      const result = await hass.connection.sendMessagePromise({
        type: "call_service",
        domain: DOMAIN,
        service,
        service_data: data,
        return_response: true,
      });
      return result?.response;
    }
    return hass.callService(DOMAIN, service, data);
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function fireEvent(el, type, detail) {
    el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  // Runs `doRender` (typically `this._render()`, a full innerHTML rebuild)
  // while preserving focus/cursor position on whatever input inside `el`
  // currently has it. A rebuild always destroys and recreates every child
  // node, including the focused one, so even a re-render that produces
  // byte-identical markup still silently drops focus and the cursor -
  // which is exactly what made editor fields feel like they "stopped
  // accepting keystrokes": a re-render landing while the user was mid-
  // typing (an echoed config-changed event, or the one-time translations/
  // fixed-attributes load callback resolving) would rebuild the DOM under
  // their cursor. Only handles simple text-like inputs identified by id
  // (matching how every field in this file's editors and forms is built) -
  // good enough here since that's the only kind of thing that can hold
  // focus in these editors.
  function renderPreservingFocus(el, doRender) {
    const active = document.activeElement;
    let restore = null;
    if (active && active.id && el.contains(active)) {
      restore = { id: active.id, selectionStart: active.selectionStart, selectionEnd: active.selectionEnd };
    }
    doRender();
    if (!restore) return;
    const again = el.querySelector(`#${CSS.escape(restore.id)}`);
    if (!again) return;
    again.focus();
    if (typeof again.setSelectionRange === "function" && restore.selectionStart != null) {
      try {
        again.setSelectionRange(restore.selectionStart, restore.selectionEnd);
      } catch (err) {
        // Not all input types support setSelectionRange (e.g. type=number) -
        // focus is already restored above either way, which is the part
        // that actually matters for "can I keep typing".
      }
    }
  }

  // ---------------------------------------------------------------------
  // Shared visual editor styling + widgets. Editors render into light DOM
  // (this.innerHTML, not a shadow root), so this <style> tag is included
  // directly in that markup. ha-formfield/ha-checkbox/ha-switch (already
  // globally registered by the HA frontend) render fine here, but
  // ha-textfield does not reliably render when loaded from a third-party
  // extra-module-url script rather than HA's own settings UI, so text/
  // number fields use a plain, self-styled <input> instead.
  // ---------------------------------------------------------------------
  const EDITOR_STYLE = css`
    <style>
      .le-editor { display: flex; flex-direction: column; gap: 16px; padding: 16px; }
      .le-editor-field { display: flex; flex-direction: column; gap: 4px; }
      .le-editor-field label { font-size: 12px; color: var(--secondary-text-color); }
      .le-editor-field input, .le-editor-field select {
        font: inherit; font-size: 16px; padding: 10px 12px; border-radius: 6px;
        border: 1px solid var(--divider-color); background: var(--card-background-color);
        color: var(--primary-text-color); width: 100%; box-sizing: border-box;
      }
      .le-editor-field input:focus, .le-editor-field select:focus { outline: none; border-color: var(--primary-color); }
      .le-editor-label { font-size: 12px; color: var(--secondary-text-color); margin-bottom: -8px; }
      .le-editor-types { display: flex; flex-wrap: wrap; gap: 4px 16px; }
      .le-hint { font-size: 12px; color: var(--secondary-text-color); margin-top: -8px; }
      /* .le-contact-option(s) live in LifeEventsBaseCard._shell()'s own
         <style> block instead of here - unlike this EDITOR_STYLE constant
         (only included by Upcoming/Month's _render() and the config
         editors), _shell() is the one style location shared by all THREE
         live cards' _render(), including Manage's - and the primary-
         contact picker renders inside Manage's own popup too. */
      .le-fixed-attr-row { display: flex; gap: 8px; align-items: center; }
      .le-fixed-attr-row input, .le-fixed-attr-row select {
        font: inherit; font-size: 14px; padding: 8px 10px; border-radius: 6px;
        border: 1px solid var(--divider-color); background: var(--card-background-color);
        color: var(--primary-text-color);
      }
      .le-fixed-attr-row .fa-key { flex: 1; min-width: 0; }
      .le-fixed-attr-row .fa-kind { flex: 0 0 auto; }
      .le-fixed-attr-row .fa-options { flex: 1.5; min-width: 0; }
      .le-icon-btn { cursor: pointer; background: none; border: none; color: var(--secondary-text-color); font-size: 18px; padding: 4px; flex: 0 0 auto; }
      button.le-btn { padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; background: var(--primary-color); color: var(--text-primary-color, #fff); font: inherit; align-self: flex-start; }
      button.le-btn.secondary { background: var(--secondary-background-color); color: var(--primary-text-color); }
    </style>
  `;

  function renderEditorField(id, label, value, extraAttrs) {
    return css`
      <div class="le-editor-field">
        <label for="${id}">${label}</label>
        <input id="${id}" value="${value}" ${extraAttrs || ""} />
      </div>
    `;
  }

  function renderEditorSelect(id, label, options, selectedValue) {
    return css`
      <div class="le-editor-field">
        <label for="${id}">${label}</label>
        <select id="${id}">
          ${options
            .map(([value, text]) => `<option value="${value}" ${value === selectedValue ? "selected" : ""}>${text}</option>`)
            .join("")}
        </select>
      </div>
    `;
  }

  // Shared by all 3 card editors' date-format picker (see formatDate()/
  // normalizeDateFormat()): 4 small controls composing the full spectrum
  // from "dd-mm-yyyy" to "dddd mmmm dd yyyy" (and everything between)
  // instead of a fixed handful of presets.
  function renderDateFormatFields(config) {
    const cfg = normalizeDateFormat(config.date_format);
    return css`
      <div class="le-editor-label">${t("editor_date_format")}</div>
      <ha-formfield label="${t("date_format_show_weekday")}">
        <ha-switch id="date_format_weekday" ${cfg.weekday ? "checked" : ""}></ha-switch>
      </ha-formfield>
      ${renderEditorSelect(
        "date_format_month",
        t("date_format_month_label"),
        [
          ["numeric", t("date_format_month_numeric")],
          ["long", t("date_format_month_name")],
        ],
        cfg.month
      )}
      ${renderEditorSelect(
        "date_format_order",
        t("date_format_order_label"),
        [
          ["dm", t("date_format_order_dm")],
          ["md", t("date_format_order_md")],
        ],
        cfg.order
      )}
      <ha-formfield label="${t("date_format_show_year")}">
        <ha-switch id="date_format_year" ${cfg.year ? "checked" : ""}></ha-switch>
      </ha-formfield>
    `;
  }

  // `updateFn(patch)` - typically `(patch) => this._update(patch)` - is
  // called with a full, merged `{ date_format: {...} }` patch on any one
  // field changing, so a single-field edit never has to know (or clobber)
  // the other three.
  function bindDateFormatFields(el, config, updateFn) {
    const cfg = normalizeDateFormat(config.date_format);
    const weekdayEl = el.querySelector("#date_format_weekday");
    if (weekdayEl) weekdayEl.addEventListener("change", (e) => updateFn({ date_format: { ...cfg, weekday: e.target.checked } }));
    const monthEl = el.querySelector("#date_format_month");
    if (monthEl) monthEl.addEventListener("change", (e) => updateFn({ date_format: { ...cfg, month: e.target.value } }));
    const orderEl = el.querySelector("#date_format_order");
    if (orderEl) orderEl.addEventListener("change", (e) => updateFn({ date_format: { ...cfg, order: e.target.value } }));
    const yearEl = el.querySelector("#date_format_year");
    if (yearEl) yearEl.addEventListener("change", (e) => updateFn({ date_format: { ...cfg, year: e.target.checked } }));
  }

  function renderEventTypeCheckboxes(selectedTypes) {
    const selected = selectedTypes || [];
    return css`
      <div class="le-editor-label">${t("editor_type_filter")}</div>
      <div class="le-editor-types">
        ${["birthday", "anniversary", "deceased"]
          .map(
            (ty) => css`
              <ha-formfield label="${eventTypeLabel(ty)}">
                <ha-checkbox data-type="${ty}" ${selected.includes(ty) ? "checked" : ""}></ha-checkbox>
              </ha-formfield>
            `
          )
          .join("")}
      </div>
    `;
  }

  // ---------------------------------------------------------------------
  // Fixed-attribute schema editor - only used by LifeEventsManageCardEditor.
  // Writes straight to the backend via the set_fixed_attributes service
  // rather than through this._update()/config-changed like the rest of the
  // editor: this isn't part of THIS card's own config, it's an install-wide
  // setting shared by every card's edit form (see the ensureFixedAttributes
  // block near the top of this file), so it doesn't belong in Lovelace's
  // per-card config at all.
  // ---------------------------------------------------------------------
  function fixedAttrsEditorRowsHtml(list) {
    return list
      .map(
        (fa) => css`
          <div class="le-fixed-attr-row" data-fixed-attr-row>
            <input class="fa-key" placeholder="${escapeAttr(t("fixed_attr_key_placeholder"))}" value="${escapeAttr(fa.key || "")}" />
            <select class="fa-kind">
              <option value="text" ${!fa.options ? "selected" : ""}>${t("fixed_attr_kind_text")}</option>
              <option value="dropdown" ${fa.options ? "selected" : ""}>${t("fixed_attr_kind_dropdown")}</option>
            </select>
            <input class="fa-options" placeholder="${escapeAttr(t("fixed_attr_options_placeholder"))}" value="${escapeAttr((fa.options || []).join(", "))}" style="${fa.options ? "" : "display:none;"}" />
            <button type="button" class="le-icon-btn" data-action="remove-fixed-attr">✕</button>
          </div>
        `
      )
      .join("");
  }

  function bindFixedAttrsRow(row) {
    const kindSelect = row.querySelector(".fa-kind");
    const optionsInput = row.querySelector(".fa-options");
    kindSelect.addEventListener("change", () => {
      optionsInput.style.display = kindSelect.value === "dropdown" ? "" : "none";
    });
    row.querySelector('[data-action="remove-fixed-attr"]').addEventListener("click", () => row.remove());
  }

  function bindFixedAttrsSection(root, hass) {
    const container = root.querySelector("#fixed-attrs-rows");
    if (!container) return;
    container.querySelectorAll("[data-fixed-attr-row]").forEach(bindFixedAttrsRow);

    const addBtn = root.querySelector('[data-action="add-fixed-attr"]');
    if (addBtn)
      addBtn.addEventListener("click", () => {
        container.insertAdjacentHTML("beforeend", fixedAttrsEditorRowsHtml([{ key: "", options: null }]));
        bindFixedAttrsRow(container.lastElementChild);
      });

    const saveBtn = root.querySelector('[data-action="save-fixed-attrs"]');
    const statusEl = root.querySelector("#fixed-attrs-status");
    if (saveBtn)
      saveBtn.addEventListener("click", async () => {
        const list = [];
        container.querySelectorAll("[data-fixed-attr-row]").forEach((row) => {
          const key = row.querySelector(".fa-key").value.trim();
          if (!key) return;
          const kind = row.querySelector(".fa-kind").value;
          const fa = { key };
          if (kind === "dropdown") {
            fa.options = row
              .querySelector(".fa-options")
              .value.split(",")
              .map((s) => s.trim())
              .filter(Boolean);
          }
          list.push(fa);
        });
        await callService(hass, "set_fixed_attributes", { fixed_attributes: list });
        // Updates the shared module-level cache directly so this tab's card
        // edit forms reflect the change immediately, without waiting for
        // a fresh get_fixed_attributes round trip.
        fixedAttrsCache = list;
        fixedAttrsLoaded = true;
        if (statusEl) statusEl.textContent = t("status_saved");
      });
  }

  function bindEventTypeCheckboxes(root, onChange) {
    const boxes = Array.from(root.querySelectorAll("ha-checkbox[data-type]"));
    boxes.forEach((cb) =>
      cb.addEventListener("change", () => {
        onChange(boxes.filter((c) => c.checked).map((c) => c.dataset.type));
      })
    );
  }

  // ---------------------------------------------------------------------
  // Shared base class: handles the hass setter / re-render plumbing so each
  // card only has to implement render().
  // ---------------------------------------------------------------------
  class LifeEventsBaseCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = {};
    }

    setConfig(config) {
      this._config = config || {};
      // Invalidates the "skip render if the body markup is unchanged"
      // cache some subclasses keep (see LifeEventsUpcomingCard/
      // LifeEventsMonthCard's _render()) - a real config change (title,
      // collapsible, columns, ...) must always take effect even if it
      // wouldn't otherwise change the computed row markup.
      this._lastBodyHtml = null;
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      // Kicks off a fetch for this hass's language the first time it's
      // seen; a no-op once cached (see ensureTranslations()). The callback
      // only fires once per language, right after it first loads - not on
      // every subsequent tick - but that one time can still land while a
      // modal is open, so it must go through the exact same guard as an
      // ordinary tick below (_safeRerender()), not call _render()
      // directly - an earlier version did call it directly, which bypassed
      // the modal check entirely and could wipe an open add/edit form the
      // moment translations/fixed-attributes finished their first load.
      ensureTranslations(hass, () => this._safeRerender());
      ensureFixedAttributes(hass, () => this._safeRerender());
      this._safeRerender();
    }

    // Skip re-rendering while a modal is open (add/edit form, import
    // panel, details popup, ...): hass updates fire on *any* entity's
    // state change anywhere in HA, and a full re-render would wipe out
    // whatever the user is currently typing inside it. Shared by every
    // caller that might trigger a re-render outside a direct hass tick
    // (see set hass() above) so none of them can bypass this check.
    _safeRerender() {
      // This checks the actual rendered DOM (.bd-modal-backdrop, present
      // whenever any card uses modalWrap()) instead of requiring every
      // card to remember to set a `_suppressRender` flag itself - that
      // manual-bookkeeping approach is exactly how this bug reappeared
      // once already: the Upcoming/Month cards gained an editable modal
      // (the "Bewerken" popup) without anyone adding the matching
      // suppression logic. Checking the DOM directly makes it correct by
      // construction for every card, including future ones, with nothing
      // to remember. `_suppressRender` is still honored below for a card
      // that needs to suppress for a reason a modal check can't see (e.g.
      // the Manage card's always-visible, non-modal search/filter bar,
      // which has its own hass override anyway - see LifeEventsManageCard).
      if (this.shadowRoot && this.shadowRoot.querySelector(".bd-modal-backdrop")) return;
      if (this._suppressRender) return;
      this._render();
    }

    get hass() {
      return this._hass;
    }

    getCardSize() {
      return 3;
    }

    _shell(bodyHtml) {
      const title = this._config.title;
      const collapsible = !!this._config.collapsible;
      const collapsed = collapsible && !!this._collapsed;
      // Collapsible cards build their own header (so a toggle arrow can go
      // in it) instead of using <ha-card header="...">, which only takes a
      // plain string. Non-collapsible cards are untouched - same native
      // header as always, no visual change.
      const headerHtml = collapsible
        ? css`
            <div class="bd-card-header" data-action="toggle-collapse">
              <span>${title ? escapeAttr(title) : ""}</span>
              <ha-icon icon="${collapsed ? "mdi:chevron-down" : "mdi:chevron-up"}"></ha-icon>
            </div>
          `
        : "";
      this.shadowRoot.innerHTML = css`
        <ha-card ${!collapsible && title ? `header="${title}"` : ""}>
          <style>
            .bd-card-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 0; cursor: pointer; user-select: none; font-size: 1.2em; font-weight: 400; }
            .bd-body { padding: 0 16px 16px; }
            table.bd-table { width: 100%; border-collapse: collapse; font-size: 14px; }
            table.bd-table th { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--divider-color); color: var(--secondary-text-color); }
            table.bd-table th[data-sort] { cursor: pointer; user-select: none; white-space: nowrap; }
            table.bd-table th[data-sort]:hover { color: var(--primary-text-color); }
            table.bd-table td { padding: 4px 8px; border-bottom: 1px solid var(--divider-color); }
            .bd-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--divider-color); }
            .bd-row:last-child { border-bottom: none; }
            .bd-row[data-action], table.bd-table tr[data-action] { cursor: pointer; }
            .bd-row[data-action]:hover, table.bd-table tr[data-action]:hover { background: var(--secondary-background-color); }
            .bd-details-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 8px; }
            .bd-details-row:nth-child(odd) { background: var(--secondary-background-color); }
            .bd-details-label { color: var(--secondary-text-color); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
            .bd-details-value { font-weight: 600; text-align: right; }
            .bd-details-edit-btn { display: flex; align-items: center; justify-content: center; gap: 6px; width: 100%; margin-top: 16px; }
            .bd-left { display: flex; align-items: center; gap: 12px; }
            .bd-name { font-weight: 500; }
            .bd-secondary { font-size: 12px; color: var(--secondary-text-color); }
            .bd-badge { background: var(--primary-color); color: var(--text-primary-color, #fff); border-radius: 12px; padding: 2px 10px; font-size: 12px; font-weight: 600; min-width: 24px; text-align: center; flex-shrink: 0; white-space: nowrap; }
            .bd-months { display: grid; grid-template-columns: repeat(${this._config.columns || 3}, 1fr); gap: 6px; margin-bottom: 12px; }
            .bd-month-btn { padding: 8px 4px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; background: var(--secondary-background-color); color: var(--primary-text-color); }
            .bd-month-btn.selected { background: var(--primary-color); color: var(--text-primary-color, #fff); }
            .bd-empty { color: var(--secondary-text-color); font-style: italic; padding: 8px 0; }
            .bd-deceased-note { color: var(--secondary-text-color); font-style: italic; text-align: center; padding: 10px 12px 0; }
            .bd-form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
            .bd-form label { font-size: 12px; color: var(--secondary-text-color); }
            .bd-form input, .bd-form select, .bd-form textarea { padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); font: inherit; }
            .bd-form textarea#f-yaml { font-family: var(--code-font-family, monospace); font-size: 13px; white-space: pre; }
            .bd-actions { display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
            .bd-attr-row { display: flex; gap: 8px; margin-bottom: 6px; }
            .bd-attr-row input { flex: 1; min-width: 0; }
            .bd-confirm { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; padding: 12px; border-radius: 6px; background: var(--secondary-background-color); }
            .le-combobox { position: relative; }
            .le-combobox-input { width: 100%; box-sizing: border-box; }
            .le-combobox-list { position: absolute; top: 100%; left: 0; right: 0; z-index: 5; max-height: 220px; overflow-y: auto; background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 6px; margin-top: 2px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
            .le-combobox-option { padding: 8px 10px; cursor: pointer; font-size: 14px; }
            .le-combobox-option:hover { background: var(--secondary-background-color); }
            .le-combobox-option-pinned { font-weight: 600; color: var(--primary-color); border-bottom: 1px solid var(--divider-color); }
            .bd-backfill { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
            .bd-backfill-pill { font-size: 12px; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--divider-color); cursor: pointer; background: var(--secondary-background-color); color: var(--primary-text-color); }
            .bd-backfill-pill.active { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); }
            .bd-filters { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
            .bd-filters input, .bd-filters select { padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); font: inherit; }
            .bd-filters input { flex: 1; min-width: 120px; }
            .bd-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 20; padding: 16px; box-sizing: border-box; }
            .bd-modal { background: var(--card-background-color); border-radius: 12px; max-width: 480px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
            .bd-modal-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--divider-color); flex-shrink: 0; background: var(--secondary-background-color); }
            .bd-modal-title { font-weight: 700; font-size: 17px; display: flex; align-items: center; gap: 10px; }
            .bd-modal-title ha-icon { color: var(--primary-color); }
            .bd-modal-body { padding: 16px; overflow-y: auto; }
            button.bd-btn { padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; background: var(--primary-color); color: var(--text-primary-color, #fff); font: inherit; }
            button.bd-btn.secondary { background: var(--secondary-background-color); color: var(--primary-text-color); }
            button.bd-btn.danger { background: var(--error-color, #db4437); color: #fff; }
            .bd-icon-btn { cursor: pointer; background: none; border: none; color: var(--secondary-text-color); font-size: 18px; padding: 4px; }
            .bd-section-title { font-weight: 600; margin: 16px 0 4px; }
            .bd-type-badge { font-size: 11px; padding: 1px 8px; border-radius: 10px; background: var(--secondary-background-color); color: var(--secondary-text-color); }
            .le-contact-options { display: flex; flex-wrap: wrap; gap: 6px; }
            .le-contact-option { font-size: 12px; padding: 4px 10px; border-radius: 12px; border: 1px solid var(--divider-color); cursor: pointer; background: var(--secondary-background-color); color: var(--secondary-text-color); font: inherit; text-decoration: line-through; opacity: 0.7; }
            .le-contact-option.active { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); text-decoration: none; opacity: 1; font-weight: 600; }
            .le-nav-link { color: var(--primary-color); cursor: pointer; text-decoration: underline; }
            .bd-modal-back-btn { font-size: 22px; line-height: 1; }
          </style>
          ${headerHtml}
          <div class="bd-body" style="${collapsed ? "display:none;" : ""}">${bodyHtml}</div>
        </ha-card>
      `;
      if (collapsible) {
        this.shadowRoot.querySelector('[data-action="toggle-collapse"]').addEventListener("click", () => {
          this._collapsed = !this._collapsed;
          // _collapsed lives outside bodyHtml (it only affects _shell()'s
          // own wrapper, not the row/table content some subclasses diff
          // against to skip redundant hass-tick renders - see
          // LifeEventsUpcomingCard/LifeEventsMonthCard's _render()), so
          // that cache must be invalidated here or toggling collapse would
          // look like "nothing changed" and silently do nothing.
          this._lastBodyHtml = null;
          this._render();
        });
      }
    }
  }

  // ---------------------------------------------------------------------
  // Card 1: Upcoming list
  // ---------------------------------------------------------------------
  class LifeEventsUpcomingCard extends LifeEventsBaseCard {
    static getStubConfig() {
      return { title: "Aankomende gebeurtenissen", days_ahead: 14, event_types: [] };
    }

    constructor() {
      super();
      this._detailsId = null;
      // Stack of previously-viewed detailsIds, pushed to whenever a
      // spouse/parent/child navLink is clicked inside the popup (see
      // onNavigate below) - lets the "‹" back button return to wherever
      // you drilled in from, not just close outright.
      this._detailsHistory = [];
      this._formMode = false;
      this._confirmDelete = false;
      this._countdownInterval = null;
    }

    // Timers must not survive the element being removed from the DOM
    // (dashboard navigation, card deleted from view, ...), or they'd keep
    // ticking and touching a detached shadow root forever.
    disconnectedCallback() {
      if (this._countdownInterval) clearInterval(this._countdownInterval);
    }

    _render() {
      if (!this._hass) return;
      setLangFor(this._hass);
      const daysAhead = this._config.days_ahead ?? 14;
      const events = expandOccasions(getEvents(this._hass, this._config.event_types))
        .filter((e) => e.days <= daysAhead)
        .sort((a, b) => a.days - b.days);

      const rows = events.length
        ? events
            .map((e, i) => {
              // The weekday the upcoming occurrence itself falls on this
              // year (not the weekday the person was originally born on).
              // Excludes both synthetic occasion rows: the underlying
              // person's own age_at_next_birthday is still present on
              // those (see expandOccasions), but isn't relevant to either.
              const becomesText =
                !e.isDeathAnniversary && !e.isCoupleAnniversary && e.eventType !== "deceased" && e.age != null
                  ? ` &middot; ${t("inline_becomes", { age: e.age, weekday: weekdayName(nextOccurrenceDate(e.date)) })}`
                  : "";
              // Only the death-anniversary occasion (see expandOccasions)
              // shows the "years ago" text now - the birthday occasion of
              // a deceased person stays age-less and note-less, same as
              // any other occasion.
              const deceasedText =
                e.isDeathAnniversary && e.yearsSinceDeath != null
                  ? ` &middot; ${t("deceased_years_ago_short", { years: e.yearsSinceDeath })}`
                  : "";
              // e.age is the generic "years at next occurrence" the couple's
              // real anniversary entity already gets for free (see
              // getEvents()/isCoupleAnniversary) - not a marriage-specific
              // attribute.
              const isMarried = e.relationshipType === "married";
              const nickname = e.isCoupleAnniversary && isMarried ? marriageAnniversaryNickname(e.age) : null;
              const marriageText =
                e.isCoupleAnniversary && e.age != null
                  ? ` &middot; ${t(isMarried ? "marriage_anniversary_inline" : "partnership_anniversary_inline", { years: e.age })}${nickname ? ` (${nickname})` : ""}`
                  : "";
              // Only shown when delegation is actually in effect (resolves
              // to someone other than this person) - same gating as
              // renderDetailsBody, so the overview isn't cluttered with
              // "Primair: <own name>" for everyone who hasn't set this up.
              const primaryContactText =
                e.primaryContactName && e.primaryPhoneNumber && e.primaryContactName !== e.name
                  ? ` &middot; ${t("primary_contact_inline", { name: e.primaryContactName, number: e.primaryPhoneNumber })}`
                  : "";
              return css`
              <div class="bd-row" data-action="details" data-id="${e.entity_id.split(".")[1]}">
                <div class="bd-left">
                  ${this._config.show_icon === false ? "" : `<ha-icon icon="${e.icon || EVENT_TYPE_ICONS[e.eventType]}"></ha-icon>`}
                  <div>
                    <div class="bd-name">${e.name}</div>
                    <div class="bd-secondary">${formatDate(e.date, this._config.date_format)} &middot; ${eventTypeLabel(e.eventType)}${becomesText}${deceasedText}${marriageText}${primaryContactText}</div>
                    ${i === 0 ? `<div class="bd-secondary" id="le-countdown"></div>` : ""}
                  </div>
                </div>
                <div class="bd-badge">${e.days === 0 ? t("countdown_today") : e.days}</div>
              </div>
            `;
            })
            .join("")
        : `<div class="bd-empty">${t("upcoming_empty", { days: daysAhead })}</div>`;

      // Looked up from the full, unfiltered event list (not the days_ahead-
      // filtered `events` above) so the popup still works even for an event
      // that's no longer within the window on a later re-render.
      const detailsEvent = this._detailsId
        ? getEvents(this._hass, null).find((e) => e.entity_id.split(".")[1] === this._detailsId)
        : null;

      const bodyHtml = css`
        ${rows}
        ${renderDetailsOrEditModal(detailsEvent, this._formMode, this._confirmDelete, this._config.date_format, this._hass, this._config.show_parent_phone === true, this._detailsHistory.length > 0)}
      `;

      // Most hass ticks are caused by some unrelated entity elsewhere in HA
      // and don't actually change anything this card shows - skip the full
      // shadow-DOM rebuild (which would also tear down and recreate
      // whatever the mouse happens to be hovering, flashing the :hover
      // style off and back on) when the computed markup is byte-identical
      // to last time. setConfig() clears this cache so a real config
      // change (title, collapsible, ...) always still takes effect.
      if (bodyHtml === this._lastBodyHtml) return;
      this._lastBodyHtml = bodyHtml;

      this._shell(bodyHtml);

      this.shadowRoot.querySelectorAll('[data-action="details"]').forEach((row) =>
        row.addEventListener("click", () => {
          this._detailsId = row.dataset.id;
          this._detailsHistory = []; // fresh navigation from the list, not a drill-down
          this._formMode = false;
          this._render();
        })
      );
      bindDetailsOrEditModal(this.shadowRoot, {
        hass: this._hass,
        detailsId: this._detailsId,
        formMode: this._formMode,
        isCoupleAnniversary: !!(detailsEvent && detailsEvent.isCoupleAnniversary),
        onStartEdit: () => {
          this._formMode = true;
          this._render();
        },
        onClose: () => {
          this._detailsId = null;
          this._detailsHistory = [];
          this._formMode = false;
          this._confirmDelete = false;
          this._render();
        },
        onSave: (result) => {
          if (!result.ok) return; // no dedicated status line here; field values are kept as typed
          this._formMode = false;
          this._render();
        },
        onCancelEdit: () => {
          this._formMode = false;
          this._confirmDelete = false;
          this._render();
        },
        onDeleteRequest: () => {
          this._confirmDelete = true;
          this._render();
        },
        onDeleteCancel: () => {
          this._confirmDelete = false;
          this._render();
        },
        onDeleteConfirm: () => {
          this._detailsId = null;
          this._detailsHistory = [];
          this._formMode = false;
          this._confirmDelete = false;
          this._render();
        },
        onRefresh: () => this._render(),
        onNavigate: (id) => {
          if (this._detailsId) this._detailsHistory.push(this._detailsId);
          this._detailsId = id;
          this._formMode = false;
          this._confirmDelete = false;
          this._render();
        },
        onBack: () => {
          this._detailsId = this._detailsHistory.pop() || null;
          this._formMode = false;
          this._confirmDelete = false;
          this._render();
        },
      });
      bindModalBackdrops(this.shadowRoot);

      // _shell() replaces the whole shadow DOM (including any previous
      // #le-countdown element), so any earlier interval must be torn down
      // and a fresh one started against the new element - otherwise every
      // hass tick (any entity changing state, anywhere in HA) would leak
      // another interval ticking against a detached node.
      if (this._countdownInterval) clearInterval(this._countdownInterval);
      if (events.length) {
        const target = nextOccurrenceDate(events[0].date);
        const tick = () => {
          const el = this.shadowRoot.querySelector("#le-countdown");
          if (el) el.textContent = formatCountdown(target);
        };
        tick();
        this._countdownInterval = setInterval(tick, 1000);
      }
    }

    static getConfigElement() {
      return document.createElement("life-events-upcoming-card-editor");
    }
  }

  class LifeEventsUpcomingCardEditor extends HTMLElement {
    setConfig(config) {
      const incoming = config || {};
      // HA's editor dialog echoes our own config-changed events straight
      // back into a fresh setConfig() call. Rebuilding the DOM on that
      // echo (same bug as the hass-render issue elsewhere) would wipe
      // whatever the user is mid-typing on every keystroke.
      //
      // Detected via _pendingEchoes, a set of every config snapshot this
      // editor itself has sent out but not yet seen echoed back (see
      // _update()) - not a short-lived "just fired an update" flag, and
      // not just a comparison against the single latest config either.
      // Both of those break when the user types faster than one
      // round-trip: several config-changed events can be in flight at
      // once, and their echoes can land out of order relative to more
      // recent keystrokes - comparing only against "the current config"
      // would then treat an older (but still self-issued) echo as a real
      // external change and re-render on it anyway, tearing the input
      // down mid-typing. Matching by set membership recognizes an echo as
      // "one of mine" regardless of arrival order, so it's simply
      // discarded instead of ever reaching _render().
      if (this._pendingEchoes && this._pendingEchoes.has(JSON.stringify(incoming))) {
        this._pendingEchoes.delete(JSON.stringify(incoming));
        return;
      }
      this._config = incoming;
      renderPreservingFocus(this, () => this._render());
    }
    set hass(hass) {
      this._hass = hass;
      // Fires once, the first time this hass's language/fixed-attrs
      // schema finishes loading - not on every tick - but that one time
      // can still land while the user is already mid-typing, so it goes
      // through the same focus-preserving path as everything else.
      ensureTranslations(hass, () => renderPreservingFocus(this, () => this._render()));
      ensureFixedAttributes(hass, () => renderPreservingFocus(this, () => this._render()));
    }
    _render() {
      if (!this._config) return;
      setLangFor(this._hass);
      this.innerHTML = css`
        ${EDITOR_STYLE}
        <div class="le-editor">
          ${renderEditorField("title", t("editor_title"), this._config.title ?? "")}
          ${renderEditorField("days_ahead", t("editor_days_ahead"), this._config.days_ahead ?? 14, 'type="number" min="1"')}
          <ha-formfield label="${t("editor_show_icon")}">
            <ha-switch id="show_icon" ${this._config.show_icon !== false ? "checked" : ""}></ha-switch>
          </ha-formfield>
          <ha-formfield label="${t("editor_collapsible")}">
            <ha-switch id="collapsible" ${this._config.collapsible ? "checked" : ""}></ha-switch>
          </ha-formfield>
          <ha-formfield label="${t("editor_show_parent_phone")}">
            <ha-switch id="show_parent_phone" ${this._config.show_parent_phone ? "checked" : ""}></ha-switch>
          </ha-formfield>
          ${renderDateFormatFields(this._config)}
          ${renderEventTypeCheckboxes(this._config.event_types)}
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#days_ahead").addEventListener("input", (e) => this._update({ days_ahead: Number(e.target.value) }));
      this.querySelector("#show_icon").addEventListener("change", (e) => this._update({ show_icon: e.target.checked }));
      this.querySelector("#collapsible").addEventListener("change", (e) => this._update({ collapsible: e.target.checked }));
      this.querySelector("#show_parent_phone").addEventListener("change", (e) => this._update({ show_parent_phone: e.target.checked }));
      bindDateFormatFields(this, this._config, (patch) => this._update(patch));
      bindEventTypeCheckboxes(this, (event_types) => this._update({ event_types }));
    }
    _update(patch) {
      this._config = { ...this._config, ...patch };
      this._pendingEchoes = this._pendingEchoes || new Set();
      this._pendingEchoes.add(JSON.stringify(this._config));
      fireEvent(this, "config-changed", { config: this._config });
    }
  }

  // ---------------------------------------------------------------------
  // Card 2: Month overview (button grid + table)
  // ---------------------------------------------------------------------
  class LifeEventsMonthCard extends LifeEventsBaseCard {
    static getStubConfig() {
      return { title: "Verjaardagen per maand", columns: 3, event_types: [] };
    }

    constructor() {
      super();
      this._selectedMonth = new Date().getMonth() + 1;
      this._detailsId = null;
      this._detailsHistory = [];
      this._formMode = false;
      this._confirmDelete = false;
      // Table sort state. `_sortOrder` is priority order (first = primary
      // sort key), capped at 2: activating a 3rd column evicts the oldest.
      this._sortState = {};
      this._sortOrder = [];
    }

    // Cycles a column through asc -> desc -> off -> asc ... Newly-activated
    // columns are appended to _sortOrder (lowest priority); deactivated
    // columns are removed. Activating beyond 2 evicts the oldest.
    _cycleSort(column) {
      const current = this._sortState[column];
      const next = current === undefined ? "asc" : current === "asc" ? "desc" : undefined;
      if (next === undefined) {
        delete this._sortState[column];
        this._sortOrder = this._sortOrder.filter((c) => c !== column);
      } else {
        if (current === undefined) {
          this._sortOrder.push(column);
          if (this._sortOrder.length > 2) {
            delete this._sortState[this._sortOrder.shift()];
          }
        }
        this._sortState[column] = next;
      }
      this._render();
    }

    _sortIndicator(column) {
      const state = this._sortState[column];
      if (!state) return "";
      const arrow = state === "asc" ? "▲" : "▼";
      const priority = this._sortOrder.length === 2 ? String(this._sortOrder.indexOf(column) + 1) : "";
      return ` ${arrow}${priority}`;
    }

    _render() {
      if (!this._hass) return;
      setLangFor(this._hass);
      const events = expandOccasions(getEvents(this._hass, this._config.event_types));
      const columns = this._config.columns || 3;

      const buttons = months().map((label, idx) => {
        const monthNr = idx + 1;
        const count = events.filter((e) => monthOf(e.date) === monthNr).length;
        const selected = monthNr === this._selectedMonth;
        return `<button class="bd-month-btn${selected ? " selected" : ""}" data-month="${monthNr}">${label}${count ? ` (${count})` : ""}</button>`;
      }).join("");

      const sortOrder = this._sortOrder;
      const monthEvents = events
        .filter((e) => monthOf(e.date) === this._selectedMonth)
        .sort((a, b) => {
          if (sortOrder.length === 0) {
            // Default (nothing clicked yet): ascending by day of month.
            return compareByColumn(a, b, "date", 1);
          }
          for (const col of sortOrder) {
            const dir = this._sortState[col] === "desc" ? -1 : 1;
            const cmp = compareByColumn(a, b, col, dir);
            if (cmp !== 0) return cmp;
          }
          return 0;
        });

      const table = monthEvents.length
        ? css`
          <table class="bd-table">
            <tr>
              ${Object.entries(monthTableColumns())
                .map(([col, label]) => `<th data-sort="${col}">${label}${this._sortIndicator(col)}</th>`)
                .join("")}
            </tr>
            ${monthEvents
              .map(
                (e) => css`
                <tr data-action="details" data-id="${e.entity_id.split(".")[1]}">
                  <td>${formatDate(e.date, this._config.date_format)}</td>
                  <td>${e.name}</td>
                  <td><span class="bd-type-badge">${eventTypeLabel(e.eventType)}</span></td>
                  <td>${
                    e.isCoupleAnniversary
                      ? e.age != null
                        ? (e.relationshipType === "married" && marriageAnniversaryNickname(e.age)) ||
                          t(e.relationshipType === "married" ? "marriage_anniversary_years_short" : "partnership_anniversary_years_short", { years: e.age })
                        : ""
                      : e.isDeathAnniversary
                        ? e.yearsSinceDeath != null
                          ? t("deceased_years_ago_short", { years: e.yearsSinceDeath })
                          : ""
                        : e.eventType === "deceased"
                          ? ""
                          : e.age ?? ""
                  }</td>
                </tr>
              `
              )
              .join("")}
          </table>
        `
        : `<div class="bd-empty">${t("month_empty", { month: months()[this._selectedMonth - 1] })}</div>`;

      const detailsEvent = this._detailsId
        ? getEvents(this._hass, null).find((e) => e.entity_id.split(".")[1] === this._detailsId)
        : null;

      const bodyHtml = css`
        <div class="bd-months">${buttons}</div>
        ${table}
        ${renderDetailsOrEditModal(detailsEvent, this._formMode, this._confirmDelete, this._config.date_format, this._hass, this._config.show_parent_phone === true, this._detailsHistory.length > 0)}
      `;

      // See LifeEventsUpcomingCard._render() for why this skips the full
      // rebuild (and the :hover flicker that comes with it) when nothing
      // this card actually shows has changed.
      if (bodyHtml === this._lastBodyHtml) return;
      this._lastBodyHtml = bodyHtml;

      this._shell(bodyHtml);

      this.shadowRoot.querySelectorAll(".bd-month-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          this._selectedMonth = Number(btn.dataset.month);
          this._render();
        });
      });
      this.shadowRoot.querySelectorAll("th[data-sort]").forEach((th) => {
        th.addEventListener("click", () => this._cycleSort(th.dataset.sort));
      });
      this.shadowRoot.querySelectorAll('[data-action="details"]').forEach((row) =>
        row.addEventListener("click", () => {
          this._detailsId = row.dataset.id;
          this._detailsHistory = []; // fresh navigation from the table, not a drill-down
          this._formMode = false;
          this._render();
        })
      );
      bindDetailsOrEditModal(this.shadowRoot, {
        hass: this._hass,
        detailsId: this._detailsId,
        formMode: this._formMode,
        isCoupleAnniversary: !!(detailsEvent && detailsEvent.isCoupleAnniversary),
        onStartEdit: () => {
          this._formMode = true;
          this._render();
        },
        onClose: () => {
          this._detailsId = null;
          this._detailsHistory = [];
          this._formMode = false;
          this._confirmDelete = false;
          this._render();
        },
        onSave: (result) => {
          if (!result.ok) return;
          this._formMode = false;
          this._render();
        },
        onCancelEdit: () => {
          this._formMode = false;
          this._confirmDelete = false;
          this._render();
        },
        onDeleteRequest: () => {
          this._confirmDelete = true;
          this._render();
        },
        onDeleteCancel: () => {
          this._confirmDelete = false;
          this._render();
        },
        onDeleteConfirm: () => {
          this._detailsId = null;
          this._detailsHistory = [];
          this._formMode = false;
          this._confirmDelete = false;
          this._render();
        },
        onRefresh: () => this._render(),
        onNavigate: (id) => {
          if (this._detailsId) this._detailsHistory.push(this._detailsId);
          this._detailsId = id;
          this._formMode = false;
          this._confirmDelete = false;
          this._render();
        },
        onBack: () => {
          this._detailsId = this._detailsHistory.pop() || null;
          this._formMode = false;
          this._confirmDelete = false;
          this._render();
        },
      });
      bindModalBackdrops(this.shadowRoot);
    }

    static getConfigElement() {
      return document.createElement("life-events-month-card-editor");
    }
  }

  class LifeEventsMonthCardEditor extends HTMLElement {
    setConfig(config) {
      const incoming = config || {};
      // See LifeEventsUpcomingCardEditor's setConfig() for why this uses
      // _pendingEchoes rather than a timing-based flag or a plain
      // comparison against just the latest config.
      if (this._pendingEchoes && this._pendingEchoes.has(JSON.stringify(incoming))) {
        this._pendingEchoes.delete(JSON.stringify(incoming));
        return;
      }
      this._config = incoming;
      renderPreservingFocus(this, () => this._render());
    }
    set hass(hass) {
      this._hass = hass;
      ensureTranslations(hass, () => renderPreservingFocus(this, () => this._render()));
      ensureFixedAttributes(hass, () => renderPreservingFocus(this, () => this._render()));
    }
    _render() {
      if (!this._config) return;
      setLangFor(this._hass);
      this.innerHTML = css`
        ${EDITOR_STYLE}
        <div class="le-editor">
          ${renderEditorField("title", t("editor_title"), this._config.title ?? "")}
          ${renderEditorField("columns", t("editor_columns"), this._config.columns ?? 3, 'type="number" min="1" max="6"')}
          <ha-formfield label="${t("editor_collapsible")}">
            <ha-switch id="collapsible" ${this._config.collapsible ? "checked" : ""}></ha-switch>
          </ha-formfield>
          <ha-formfield label="${t("editor_show_parent_phone")}">
            <ha-switch id="show_parent_phone" ${this._config.show_parent_phone ? "checked" : ""}></ha-switch>
          </ha-formfield>
          ${renderDateFormatFields(this._config)}
          ${renderEventTypeCheckboxes(this._config.event_types)}
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#columns").addEventListener("input", (e) => this._update({ columns: Number(e.target.value) }));
      this.querySelector("#collapsible").addEventListener("change", (e) => this._update({ collapsible: e.target.checked }));
      this.querySelector("#show_parent_phone").addEventListener("change", (e) => this._update({ show_parent_phone: e.target.checked }));
      bindDateFormatFields(this, this._config, (patch) => this._update(patch));
      bindEventTypeCheckboxes(this, (event_types) => this._update({ event_types }));
    }
    _update(patch) {
      this._config = { ...this._config, ...patch };
      this._pendingEchoes = this._pendingEchoes || new Set();
      this._pendingEchoes.add(JSON.stringify(this._config));
      fireEvent(this, "config-changed", { config: this._config });
    }
  }

  // ---------------------------------------------------------------------
  // Card 3: Manage (add / edit / delete / import / export)
  // ---------------------------------------------------------------------
  class LifeEventsManageCard extends LifeEventsBaseCard {
    static getStubConfig() {
      return { title: "Verjaardagen beheren", event_types: [], display_mode: "full" };
    }

    constructor() {
      super();
      this._editingId = null;
      this._formOpen = false;
      this._importOpen = false;
      this._panelOpen = false;
      this._autoOpenTried = false;
      this._status = "";
      this._searchQuery = "";
      this._monthFilter = "";
      this._genderFilter = "";
      this._attrFilterKey = "";
      this._attrFilterValue = "";
      this._missingAttrFilter = "";
      this._confirmDelete = false;
    }

    // Overrides the base class's hass setter. That one calls a full
    // _render() on every hass update, which is fine for the Upcoming/Month
    // cards (no inputs), but this card's search box and month filter live
    // inline in the card body (not just inside a modal), so they'd lose
    // focus on every hass tick the same way the add/edit form used to.
    // After the first render, route hass updates through the targeted
    // _renderList() instead - same reasoning as _suppressRender, just
    // covering the always-visible filter bar too, not only the modals.
    get hass() {
      return this._hass;
    }

    set hass(hass) {
      const firstRender = !this._hass;
      this._hass = hass;
      // Same reasoning as LifeEventsBaseCard._safeRerender(): the one-time
      // load callback must not call _render() unconditionally, since that
      // would bypass this card's own _suppressRender guard (the base
      // class's modal-backdrop check doesn't cover this card's
      // always-visible search/filter bar - that's why this card overrides
      // hass at all) and could wipe an open add/edit form or in-progress
      // search text.
      // A full _render() here (even guarded by _suppressRender) would
      // still wipe the always-visible search/month/gender/attribute filter
      // bar if the user happens to be typing in it with no modal open -
      // that's exactly why ordinary hass ticks route through the
      // targeted _renderList() instead of _render() below; this callback
      // does the same, for the same reason.
      const rerenderIfSafe = () => {
        if (this._suppressRender) return;
        if (this._hass) this._renderList();
      };
      ensureTranslations(hass, rerenderIfSafe);
      ensureFixedAttributes(hass, rerenderIfSafe);
      if (firstRender) {
        this._render();
      } else if (!this._suppressRender) {
        this._renderList();
      }
    }

    // Base list for this card (config's event_types filter only). Used for
    // the editing lookup, independent of the live search/month filter -
    // you're always editing something already visible when you click it.
    _baseEvents() {
      return getEvents(this._hass, this._config.event_types).sort((a, b) => a.name.localeCompare(b.name));
    }

    // Every custom attribute key seen across events, except "geslacht"
    // (that one gets its own dedicated dropdown below) - lets the extra
    // attribute filter adapt to whatever the user has actually defined
    // (connectie, nummer_van, ...) instead of hardcoding more fields.
    _knownAttributeKeys() {
      const keys = new Set();
      this._baseEvents().forEach((e) => Object.keys(e.attributes || {}).forEach((k) => k !== "geslacht" && keys.add(k)));
      return [...keys].sort();
    }

    _knownAttributeValues(key) {
      const values = new Set();
      this._baseEvents().forEach((e) => {
        const v = e.attributes && e.attributes[key];
        if (v) values.add(v);
      });
      return [...values].sort();
    }

    // For each configured fixed attribute (see the ensureFixedAttributes
    // block near the top of this file), how many currently-visible events
    // are missing it entirely - i.e. would fail the same required-field
    // check saveEventForm() enforces on the next edit, but nothing
    // surfaces that until someone happens to open that specific event.
    // Drives the clickable "backfill" pills in the panel body below;
    // attributes with nothing missing are left out rather than shown as
    // "0 ontbrekend".
    _fixedAttrMissingCounts() {
      // Couple's-anniversary entities (see isCoupleAnniversary) never go
      // through _check_required_attributes - excluding them here avoids a
      // spurious "geslacht: 1 ontbrekend" nudge for an entity that was
      // never supposed to have one.
      const events = this._baseEvents().filter((e) => !e.isCoupleAnniversary);
      return fixedAttrsCache
        .map((fa) => ({ key: fa.key, count: events.filter((e) => !e.attributes[fa.key]).length }))
        .filter((m) => m.count > 0);
    }

    _rowsHtml() {
      const q = this._searchQuery.trim().toLowerCase();
      const anyFilterActive =
        q || this._monthFilter || this._genderFilter || (this._attrFilterKey && this._attrFilterValue) || this._missingAttrFilter;
      if (!anyFilterActive) {
        return `<div class="bd-empty">${t("panel_choose_filter")}</div>`;
      }

      const events = this._baseEvents()
        .filter((e) => !q || e.name.toLowerCase().includes(q))
        .filter((e) => !this._missingAttrFilter || !e.attributes[this._missingAttrFilter])
        .filter((e) => !this._monthFilter || monthOf(e.date) === Number(this._monthFilter))
        .filter(
          (e) => !this._genderFilter || (e.attributes.geslacht || "").trim().toLowerCase() === this._genderFilter
        )
        .filter(
          (e) =>
            !this._attrFilterKey ||
            !this._attrFilterValue ||
            e.attributes[this._attrFilterKey] === this._attrFilterValue
        );

      return events.length
        ? events
            .map((e) => {
              // Same gating as the Upcoming card's row / renderDetailsBody -
              // only shown when delegation actually resolves to someone
              // other than this person.
              const primaryContactLine =
                e.primaryContactName && e.primaryPhoneNumber && e.primaryContactName !== e.name
                  ? `<div class="bd-secondary">${escapeAttr(t("primary_contact_inline", { name: e.primaryContactName, number: e.primaryPhoneNumber }))}</div>`
                  : "";
              return css`
              <div class="bd-row" data-action="edit" data-id="${e.entity_id.split(".")[1]}">
                <div class="bd-left">
                  <ha-icon icon="${e.icon || EVENT_TYPE_ICONS[e.eventType]}"></ha-icon>
                  <div>
                    <div class="bd-name">${e.name}</div>
                    <div class="bd-secondary">${formatDate(e.date, this._config.date_format)} &middot; <span class="bd-type-badge">${eventTypeLabel(e.eventType)}</span></div>
                    ${primaryContactLine}
                    ${Object.keys(e.attributes).length
                      ? `<div class="bd-secondary">${Object.entries(e.attributes)
                          .map(([k, v]) => `${escapeAttr(k)}: ${escapeAttr(v)}`)
                          .join(" &middot; ")}</div>`
                      : ""}
                  </div>
                </div>
              </div>
            `;
            })
            .join("")
        : `<div class="bd-empty">${t("panel_no_results")}</div>`;
    }

    // Targeted update: only replaces the list container, so the search
    // input keeps focus while the user types (same reasoning as
    // _suppressRender - a full _render() here would wipe it).
    _renderList() {
      const list = this.shadowRoot.querySelector("#le-list");
      if (!list) return;
      setLangFor(this._hass);
      const rowsHtml = this._rowsHtml();
      // Same reasoning as LifeEventsUpcomingCard._render(): most hass ticks
      // don't change anything this list actually shows, so skip rebuilding
      // it (and flashing whatever row the mouse is hovering) when the
      // computed markup is unchanged. Search/filter input changes go
      // through this same method but always produce different markup (the
      // filter itself changed), so they're unaffected by this check.
      if (rowsHtml === this._lastRowsHtml) return;
      this._lastRowsHtml = rowsHtml;
      list.innerHTML = rowsHtml;
      this._bindListEvents();
    }

    _bindListEvents() {
      const list = this.shadowRoot.querySelector("#le-list");
      if (!list) return;
      list.querySelectorAll('[data-action="edit"]').forEach((btn) =>
        btn.addEventListener("click", () => {
          this._editingId = btn.dataset.id;
          this._formOpen = true;
          this._render();
        })
      );
    }

    _render() {
      if (!this._hass) return;
      setLangFor(this._hass);
      // A full _render() rebuilds #le-list fresh (e.g. when the attribute
      // filter's key changes and the value dropdown needs to appear/
      // disappear) without going through _renderList()'s cache below -
      // invalidate it here so a later _renderList() call can't wrongly
      // compare against a rowsHtml string left over from before this
      // rebuild and skip a genuinely-needed update just because two
      // different filter states happen to produce identical markup (e.g.
      // "gender=vrouw" and "search=Marlene" both showing just her row).
      this._lastRowsHtml = null;
      const isButtonMode = this._config.display_mode === "button";

      // Auto-open the add-form once, the first time we have real data and
      // there are truly zero events yet - the most useful thing to show on
      // a fresh install. Guarded so cancelling it doesn't force it back
      // open on the next render.
      if (!this._autoOpenTried) {
        this._autoOpenTried = true;
        if (this._baseEvents().length === 0) {
          this._editingId = null;
          this._formOpen = true;
          if (isButtonMode) this._panelOpen = true;
        }
      }

      // Kept in sync here (rather than at every toggle site) so a later
      // hass update skips re-rendering while any popup is open - otherwise
      // every hass tick (any entity changing state, anywhere in HA) would
      // wipe out whatever the user is currently typing.
      this._suppressRender = this._formOpen || this._importOpen || (isButtonMode && this._panelOpen);

      const editing = this._editingId ? this._baseEvents().find((e) => e.entity_id === `${DOMAIN}.${this._editingId}`) : null;

      const formBody =
        editing && editing.isCoupleAnniversary
          ? renderAnniversaryDetailsBody(editing, this._editingId, this._confirmDelete, this._config.date_format)
          : renderEventFormBody(editing, this._editingId, this._confirmDelete, this._hass);

      const importExportBody = css`
        <div class="bd-form">
          <label>${t("io_format_label")}</label>
          <select id="io-format">
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <label>${t("io_mode_label")}</label>
          <select id="io-mode">
            <option value="merge">${t("io_mode_merge")}</option>
            <option value="replace">${t("io_mode_replace")}</option>
          </select>
          <label>${t("io_file_label")}</label>
          <input id="io-file" type="file" accept=".json,.csv,application/json,text/csv" />
          <div id="io-file-status" class="bd-secondary"></div>
          <label>${t("io_content_label")}</label>
          <textarea id="io-content" rows="6"></textarea>
          <div class="bd-actions">
            <button class="bd-btn" data-action="export">${t("action_export")}</button>
            <button class="bd-btn" data-action="download">${t("action_download")}</button>
            <button class="bd-btn secondary" data-action="import">${t("action_import")}</button>
            <button class="bd-btn secondary" data-action="close-io">${t("action_close")}</button>
          </div>
        </div>
      `;

      const attrKeys = this._knownAttributeKeys();
      const attrValues = this._attrFilterKey ? this._knownAttributeValues(this._attrFilterKey) : [];
      const missingCounts = this._fixedAttrMissingCounts();

      const backfillHtml = missingCounts.length
        ? css`
          <div class="bd-backfill">
            ${missingCounts
              .map(
                (m) => css`
                <button type="button" class="bd-backfill-pill${this._missingAttrFilter === m.key ? " active" : ""}" data-action="toggle-missing" data-key="${escapeAttr(m.key)}">
                  ${t("backfill_pill_label", { key: escapeAttr(m.key), count: m.count })}
                </button>
              `
              )
              .join("")}
          </div>
        `
        : "";

      const panelBody = css`
        ${backfillHtml}
        <div class="bd-filters">
          <input id="f-search" placeholder="${escapeAttr(t("search_placeholder"))}" value="${this._searchQuery}" />
          <select id="f-month-filter">
            <option value="">${t("filter_all_months")}</option>
            ${months().map(
              (m, i) => `<option value="${i + 1}" ${Number(this._monthFilter) === i + 1 ? "selected" : ""}>${m}</option>`
            ).join("")}
          </select>
          <select id="f-gender-filter">
            <option value="">${t("filter_all_genders")}</option>
            <option value="man" ${this._genderFilter === "man" ? "selected" : ""}>${t("gender_man")}</option>
            <option value="vrouw" ${this._genderFilter === "vrouw" ? "selected" : ""}>${t("gender_vrouw")}</option>
            <option value="anders" ${this._genderFilter === "anders" ? "selected" : ""}>${t("gender_anders")}</option>
          </select>
          ${attrKeys.length
            ? css`
              <select id="f-attr-key-filter">
                <option value="">${t("filter_choose_attribute")}</option>
                ${attrKeys
                  .map((k) => `<option value="${escapeAttr(k)}" ${this._attrFilterKey === k ? "selected" : ""}>${escapeAttr(k)}</option>`)
                  .join("")}
              </select>
              ${this._attrFilterKey
                ? css`
                  <select id="f-attr-value-filter">
                    <option value="">${t("filter_all_values")}</option>
                    ${attrValues
                      .map((v) => `<option value="${escapeAttr(v)}" ${this._attrFilterValue === v ? "selected" : ""}>${escapeAttr(v)}</option>`)
                      .join("")}
                  </select>
                `
                : ""}
            `
            : ""}
        </div>
        <div class="bd-actions">
          ${!this._formOpen ? `<button class="bd-btn" data-action="add">${t("action_add_button")}</button>` : ""}
          ${!this._importOpen ? `<button class="bd-btn secondary" data-action="io">${t("label_import_export")}</button>` : ""}
        </div>
        <div id="le-list">${this._rowsHtml()}</div>
        ${this._status ? `<div class="bd-secondary" style="margin-top:8px;">${this._status}</div>` : ""}
      `;

      const mainHtml = isButtonMode
        ? this._panelOpen
          ? ""
          : css`<button class="bd-btn" data-action="open-panel">${t("action_open_panel")}</button>`
        : panelBody;

      this._shell(css`
        ${mainHtml}
        ${isButtonMode && this._panelOpen ? modalWrap(this._config.title || t("manage_default_title"), panelBody, "close-panel") : ""}
        ${this._formOpen ? modalWrap(editing ? t("action_edit") : t("action_add"), formBody, "cancel") : ""}
        ${this._importOpen ? modalWrap(t("label_import_export"), importExportBody, "close-io") : ""}
      `);

      this._bindEvents();
      this._bindFilterEvents();
      bindModalBackdrops(this.shadowRoot);
    }

    _bindEvents() {
      const root = this.shadowRoot;
      this._bindListEvents();
      // Toggles (clicking the active pill again clears it) rather than a
      // one-way filter, since there's no other control to clear it from -
      // unlike the dropdown filters above, which have their own blank
      // option. A full _render(), not _renderList(): the pill set itself
      // (and each pill's "active" highlight) lives in the panel body
      // outside #le-list, same reasoning as the attribute-key filter below.
      root.querySelectorAll('[data-action="toggle-missing"]').forEach((btn) =>
        btn.addEventListener("click", () => {
          const key = btn.dataset.key;
          this._missingAttrFilter = this._missingAttrFilter === key ? "" : key;
          this._render();
        })
      );
      const addBtn = root.querySelector('[data-action="add"]');
      if (addBtn)
        addBtn.addEventListener("click", () => {
          this._editingId = null;
          this._formOpen = true;
          this._confirmDelete = false;
          this._render();
        });
      // querySelectorAll inside bindEventFormEvents: the modal header's
      // close (X) button reuses the same data-action="cancel" as the
      // form's own Annuleren button, so there are two matching elements to
      // bind whenever the form modal is open. No-ops when it isn't (the
      // form's own root won't have any of these controls to find).
      bindEventFormEvents(root, {
        hass: this._hass,
        editingId: this._editingId,
        onSave: (result) => {
          if (!result.ok) {
            this._status = result.message;
            this._render();
            return;
          }
          this._formOpen = false;
          this._editingId = null;
          this._status = t("status_saved");
          this._render();
        },
        onCancel: () => {
          this._formOpen = false;
          this._editingId = null;
          this._confirmDelete = false;
          this._render();
        },
        onDeleteRequest: () => {
          this._confirmDelete = true;
          this._render();
        },
        onDeleteCancel: () => {
          this._confirmDelete = false;
          this._render();
        },
        onDeleteConfirm: () => {
          this._formOpen = false;
          this._editingId = null;
          this._confirmDelete = false;
          this._render();
        },
        onRefresh: () => this._render(),
      });

      const ioBtn = root.querySelector('[data-action="io"]');
      if (ioBtn)
        ioBtn.addEventListener("click", () => {
          this._importOpen = true;
          this._render();
        });
      root.querySelectorAll('[data-action="close-io"]').forEach((btn) =>
        btn.addEventListener("click", () => {
          this._importOpen = false;
          this._render();
        })
      );
      const exportBtn = root.querySelector('[data-action="export"]');
      if (exportBtn) exportBtn.addEventListener("click", () => this._export(false));
      const downloadBtn = root.querySelector('[data-action="download"]');
      if (downloadBtn) downloadBtn.addEventListener("click", () => this._export(true));
      const importBtn = root.querySelector('[data-action="import"]');
      if (importBtn) importBtn.addEventListener("click", () => this._import());
      const fileInput = root.querySelector("#io-file");
      if (fileInput) fileInput.addEventListener("change", () => this._loadFile());
      const openPanelBtn = root.querySelector('[data-action="open-panel"]');
      if (openPanelBtn)
        openPanelBtn.addEventListener("click", () => {
          this._panelOpen = true;
          this._render();
        });
      const closePanelBtn = root.querySelector('[data-action="close-panel"]');
      if (closePanelBtn)
        closePanelBtn.addEventListener("click", () => {
          this._panelOpen = false;
          this._render();
        });
    }

    _bindFilterEvents() {
      const root = this.shadowRoot;
      const searchInput = root.querySelector("#f-search");
      if (searchInput)
        searchInput.addEventListener("input", (e) => {
          this._searchQuery = e.target.value;
          this._renderList();
        });
      const monthSelect = root.querySelector("#f-month-filter");
      if (monthSelect)
        monthSelect.addEventListener("change", (e) => {
          this._monthFilter = e.target.value;
          this._renderList();
        });
      const genderSelect = root.querySelector("#f-gender-filter");
      if (genderSelect)
        genderSelect.addEventListener("change", (e) => {
          this._genderFilter = e.target.value;
          this._renderList();
        });
      const attrValueSelect = root.querySelector("#f-attr-value-filter");
      if (attrValueSelect)
        attrValueSelect.addEventListener("change", (e) => {
          this._attrFilterValue = e.target.value;
          this._renderList();
        });
      // Changing which attribute to filter on adds/removes the value
      // dropdown itself, so this needs a full _render() (not just
      // _renderList()), unlike the other filters above.
      const attrKeySelect = root.querySelector("#f-attr-key-filter");
      if (attrKeySelect)
        attrKeySelect.addEventListener("change", (e) => {
          this._attrFilterKey = e.target.value;
          this._attrFilterValue = "";
          this._render();
        });
    }

    _loadFile() {
      // Deliberately does not call _render(): that would rebuild the whole
      // panel (same class of bug as the hass-update issue above) and wipe
      // the content/status we're about to set. Update the DOM directly
      // instead, the same way typing in the textarea itself works.
      const root = this.shadowRoot;
      const file = root.querySelector("#io-file").files[0];
      if (!file) return;
      const statusEl = root.querySelector("#io-file-status");
      const reader = new FileReader();
      reader.onload = () => {
        root.querySelector("#io-content").value = reader.result;
        if (/\.csv$/i.test(file.name)) {
          root.querySelector("#io-format").value = "csv";
        } else if (/\.json$/i.test(file.name)) {
          root.querySelector("#io-format").value = "json";
        }
        statusEl.textContent = t("io_file_loaded", { file: file.name });
      };
      reader.onerror = () => {
        statusEl.textContent = t("io_file_error", { file: file.name });
      };
      reader.readAsText(file);
    }


    async _export(download) {
      // Same reasoning as _loadFile(): update the status text directly
      // rather than via this._status + _render(), since a re-render here
      // would wipe the content we just wrote into #io-content.
      const root = this.shadowRoot;
      const format = root.querySelector("#io-format").value;
      const response = await callService(this._hass, "export_events", { format }, true);
      const content = response?.content ?? "";
      if (download) {
        downloadFile(`life-events-export.${format}`, content, format === "json" ? "application/json" : "text/csv");
      } else {
        root.querySelector("#io-content").value = content;
      }
      root.querySelector("#io-file-status").textContent = t("io_export_done");
    }

    async _import() {
      const root = this.shadowRoot;
      const format = root.querySelector("#io-format").value;
      const mode = root.querySelector("#io-mode").value;
      const content = root.querySelector("#io-content").value;
      if (!content.trim()) {
        this._status = t("io_import_nothing");
        this._render();
        return;
      }
      const response = await callService(this._hass, "import_events", { content, format, mode }, true);
      this._status = t("io_import_done", { count: response?.imported ?? 0 });
      this._render();
    }

    static getConfigElement() {
      return document.createElement("life-events-manage-card-editor");
    }
  }

  class LifeEventsManageCardEditor extends HTMLElement {
    setConfig(config) {
      const incoming = config || {};
      // See LifeEventsUpcomingCardEditor's setConfig() for why this uses
      // _pendingEchoes rather than a timing-based flag or a plain
      // comparison against just the latest config.
      if (this._pendingEchoes && this._pendingEchoes.has(JSON.stringify(incoming))) {
        this._pendingEchoes.delete(JSON.stringify(incoming));
        return;
      }
      this._config = incoming;
      renderPreservingFocus(this, () => this._render());
    }
    set hass(hass) {
      this._hass = hass;
      ensureTranslations(hass, () => renderPreservingFocus(this, () => this._render()));
      ensureFixedAttributes(hass, () => renderPreservingFocus(this, () => this._render()));
    }
    _render() {
      if (!this._config) return;
      setLangFor(this._hass);
      this.innerHTML = css`
        ${EDITOR_STYLE}
        <div class="le-editor">
          ${renderEditorField("title", t("editor_title"), this._config.title ?? "")}
          ${renderEditorSelect(
            "display_mode",
            t("editor_display_mode_label"),
            [
              ["full", t("editor_display_mode_full")],
              ["button", t("editor_display_mode_button")],
            ],
            this._config.display_mode || "full"
          )}
          <ha-formfield label="${t("editor_collapsible")}">
            <ha-switch id="collapsible" ${this._config.collapsible ? "checked" : ""}></ha-switch>
          </ha-formfield>
          ${renderDateFormatFields(this._config)}
          ${renderEventTypeCheckboxes(this._config.event_types)}
          <div class="le-editor-label">${t("fixed_attrs_section_title")}</div>
          <div class="le-hint">${t("fixed_attrs_section_hint")}</div>
          <div id="fixed-attrs-rows">${fixedAttrsEditorRowsHtml(fixedAttrsCache)}</div>
          <button type="button" class="le-btn secondary" data-action="add-fixed-attr">${t("action_add_fixed_attr")}</button>
          <button type="button" class="le-btn" data-action="save-fixed-attrs">${t("action_save_fixed_attrs")}</button>
          <div id="fixed-attrs-status" class="le-hint"></div>
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#display_mode").addEventListener("change", (e) => this._update({ display_mode: e.target.value }));
      this.querySelector("#collapsible").addEventListener("change", (e) => this._update({ collapsible: e.target.checked }));
      bindDateFormatFields(this, this._config, (patch) => this._update(patch));
      bindEventTypeCheckboxes(this, (event_types) => this._update({ event_types }));
      bindFixedAttrsSection(this, this._hass);
    }
    _update(patch) {
      this._config = { ...this._config, ...patch };
      this._pendingEchoes = this._pendingEchoes || new Set();
      this._pendingEchoes.add(JSON.stringify(this._config));
      fireEvent(this, "config-changed", { config: this._config });
    }
  }

  // ---------------------------------------------------------------------
  // Registration
  // ---------------------------------------------------------------------
  customElements.define("life-events-upcoming-card", LifeEventsUpcomingCard);
  customElements.define("life-events-upcoming-card-editor", LifeEventsUpcomingCardEditor);
  customElements.define("life-events-month-card", LifeEventsMonthCard);
  customElements.define("life-events-month-card-editor", LifeEventsMonthCardEditor);
  customElements.define("life-events-manage-card", LifeEventsManageCard);
  customElements.define("life-events-manage-card-editor", LifeEventsManageCardEditor);

  // These 3 entries populate HA's "Add card" picker, which renders before
  // any card ever gets a `hass` object - there's no language to detect yet,
  // so unlike everything else in this file these are NOT run through t().
  // English is used directly (rather than Dutch) as the more broadly
  // understood default for a picker UI shown to every user regardless of
  // their configured language.
  window.customCards = window.customCards || [];
  window.customCards.push(
    {
      type: "life-events-upcoming-card",
      name: "Life Events: Upcoming",
      description: "List of upcoming birthdays, anniversaries and remembrances.",
    },
    {
      type: "life-events-month-card",
      name: "Life Events: Month overview",
      description: "Month buttons + table, like the original birthdays dashboard.",
    },
    {
      type: "life-events-manage-card",
      name: "Life Events: Manage",
      description: "Add, edit, delete, import and export.",
    }
  );
})();
