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
  console.info("Life Events cards: v0.0.2-beta.12 loaded");

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
    inline_becomes: "wordt {age}",
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

  function setLangFor(hass) {
    currentTranslations = translationsCache[resolveLang(hass)] || TRANSLATIONS_NL;
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
  ]);

  function customAttributesOf(st) {
    const out = {};
    for (const [key, value] of Object.entries(st.attributes)) {
      if (!RESERVED_EVENT_ATTRS.has(key)) out[key] = value;
    }
    return out;
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
        phoneNumber: st.attributes.phone_number,
        time: st.attributes.time,
        attributes: customAttributesOf(st),
      }))
      .filter((e) => !allowed || allowed.includes(e.eventType));
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
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
    if (diffMs <= 0) return t("countdown_today");
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
  function modalWrap(title, bodyHtml, closeAction) {
    return css`
      <div class="bd-modal-backdrop">
        <div class="bd-modal">
          <div class="bd-modal-header">
            <span class="bd-modal-title">${title}</span>
            <button class="bd-icon-btn" data-action="${closeAction}">✕</button>
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
        const closeBtn = backdrop.querySelector(".bd-modal-header [data-action]");
        if (closeBtn) closeBtn.click();
      });
    });
  }

  // Read-only "all attributes" view for a single event - used by the
  // Upcoming/Month cards' details popup (Manage card has its own editable
  // form instead).
  function renderDetailsBody(e) {
    const rows = [
      [t("label_name"), e.name],
      [t("label_date"), formatDate(e.date)],
      [t("label_type"), eventTypeLabel(e.eventType)],
    ];
    if (e.time) rows.push([t("label_time"), e.time]);
    if (e.eventType !== "deceased" && e.age != null) rows.push([t("label_becomes"), e.age]);
    if (e.eventType === "deceased" && e.dateOfDeath) rows.push([t("label_date_of_death"), formatDate(e.dateOfDeath)]);
    if (e.phoneNumber) rows.push([t("label_phone"), e.phoneNumber]);
    Object.entries(e.attributes || {}).forEach(([k, v]) => rows.push([k, v]));
    return rows
      .map(
        ([label, value]) => css`
          <div class="bd-details-row">
            <div class="bd-details-label">${escapeAttr(label)}</div>
            <div class="bd-details-value">${escapeAttr(value)}</div>
          </div>
        `
      )
      .join("");
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
          return css`
            <label>${escapeAttr(fa.key)} *</label>
            <select data-fixed-key="${escapeAttr(fa.key)}">
              <option value="" ${value ? "" : "selected"} disabled>${t("fixed_attr_choose")}</option>
              ${fa.options
                .map((o) => `<option value="${escapeAttr(o)}" ${o === value ? "selected" : ""}>${escapeAttr(o)}</option>`)
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

  // Shared add/edit form body - used by the Manage card's popup and, when
  // "Bewerken" is clicked, by the Upcoming/Month cards' details popup too.
  // `editing` is null when adding a new event.
  function renderEventFormBody(editing, editingId, confirmDelete) {
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
              <select id="f-phone-country" style="flex:0 0 auto; width:auto;">
                ${COUNTRY_CODES.map(
                  (c) =>
                    `<option value="${c[0]}" ${c[0] === phone.iso2 ? "selected" : ""}>${c[2]} (+${c[1]})</option>`
                ).join("")}
              </select>
              <input id="f-phone-local" style="flex:1;" placeholder="${escapeAttr(t("phone_placeholder"))}" value="${phone.local}" />
            `;
          })()}
        </div>
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
                ${editing ? `<button class="bd-btn danger" data-action="delete" data-id="${editingId}">${t("action_delete")}</button>` : ""}
              </div>
            `
        }
      </div>
    `;
  }

  // Reads the form fields from the DOM and performs the add_event/
  // update_event service call. Returns { ok: true } or
  // { ok: false, message } for the caller to display.
  async function saveEventForm(root, hass, editingId) {
    const firstName = root.querySelector("#f-firstname").value.trim();
    const lastName = root.querySelector("#f-lastname").value.trim();
    // Kept as one combined name everywhere except this form (storage,
    // entity naming/slugs, search, CSV/JSON export, ...) - only input/
    // editing is split into two fields for convenience (e.g. someone
    // changing their surname after marriage).
    const name = lastName ? `${firstName} ${lastName}` : firstName;
    const eventType = root.querySelector("#f-type").value;
    const dateVal = root.querySelector("#f-date").value;
    const timeVal = root.querySelector("#f-time").value;
    const dateOfDeath = root.querySelector("#f-date-death").value;
    const icon = root.querySelector("#f-icon").value.trim();
    const phoneCountry = root.querySelector("#f-phone-country").value;
    const phoneLocal = root.querySelector("#f-phone-local").value.trim();

    if (!firstName || !dateVal) {
      return { ok: false, message: t("validation_required") };
    }

    const fixedFieldValues = {};
    root.querySelectorAll("[data-fixed-key]").forEach((field) => {
      fixedFieldValues[field.dataset.fixedKey] = field.value.trim();
    });
    const fixedValues = {};
    for (const fa of fixedAttrsCache) {
      const value = fixedFieldValues[fa.key] || "";
      if (!value) {
        return { ok: false, message: t("validation_required_fixed", { key: fa.key }) };
      }
      fixedValues[fa.key] = value;
    }

    const data = { name, event_type: eventType, date: dateVal };
    if (icon) data.icon = icon;
    if (eventType === "deceased" && dateOfDeath) data.date_of_death = dateOfDeath;
    // Only meaningful for birthday/anniversary; clears any previously set
    // number if the type was switched to deceased or the field was emptied.
    data.phone_number = PHONE_EVENT_TYPES.includes(eventType) && phoneLocal ? toE164(phoneLocal, phoneCountry) : "";
    // Always included (even ""), same as phone_number, so clearing the
    // field actually clears the stored value instead of leaving it as-is.
    data.time = timeVal || "";
    // Always included (even {}), so removing every row actually clears
    // previously stored attributes - update_event replaces this field
    // wholesale rather than merging it key by key (see manager.py).
    const attributes = { ...fixedValues };
    root.querySelectorAll("#f-attrs-rows .bd-attr-row").forEach((row) => {
      const key = row.querySelector(".f-attr-key").value.trim();
      const value = row.querySelector(".f-attr-value").value.trim();
      if (key) attributes[key] = value;
    });
    data.attributes = attributes;

    if (editingId) {
      await callService(hass, "update_event", { event_id: editingId, ...data });
    } else {
      await callService(hass, "add_event", data);
    }
    return { ok: true };
  }

  // Binds every control inside renderEventFormBody()'s markup. `ctx`:
  //   hass, editingId
  //   onSave(result)       - result is { ok, message? } from saveEventForm()
  //   onCancel()
  //   onDeleteRequest()    - "Verwijderen" clicked, show the confirm step
  //   onDeleteCancel()
  //   onDeleteConfirm()    - delete_event already called, entity is gone
  function bindEventFormEvents(root, ctx) {
    root.querySelectorAll('[data-action="cancel"]').forEach((btn) => btn.addEventListener("click", ctx.onCancel));
    const saveBtn = root.querySelector('[data-action="save"]');
    if (saveBtn)
      saveBtn.addEventListener("click", async () => {
        const result = await saveEventForm(root, ctx.hass, ctx.editingId);
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
  }

  // Shared by the Upcoming and Month cards: a details popup that can flip
  // into the same edit form the Manage card uses, via a "Bewerken" button.
  // `detailsEvent` is the resolved event object (or null - no popup); the
  // returned HTML already includes the modal wrapper.
  function renderDetailsOrEditModal(detailsEvent, formMode, confirmDelete) {
    if (!detailsEvent) return "";
    const editingId = detailsEvent.entity_id.split(".")[1];
    const title = css`
      <ha-icon icon="${detailsEvent.icon || EVENT_TYPE_ICONS[detailsEvent.eventType]}"></ha-icon>
      <span>${escapeAttr(detailsEvent.name)}</span>
    `;
    const body = formMode
      ? renderEventFormBody(detailsEvent, editingId, confirmDelete)
      : css`
          ${renderDetailsBody(detailsEvent)}
          <button type="button" class="bd-btn bd-details-edit-btn" data-action="start-edit">
            <ha-icon icon="mdi:pencil"></ha-icon> ${t("action_edit")}
          </button>
        `;
    return modalWrap(title, body, formMode ? "cancel" : "close-details");
  }

  // ctx: hass, detailsId, formMode, onStartEdit(), onClose(),
  // onSave(result), onCancelEdit(), onDeleteRequest(), onDeleteCancel(),
  // onDeleteConfirm()
  function bindDetailsOrEditModal(root, ctx) {
    root.querySelectorAll('[data-action="close-details"]').forEach((btn) => btn.addEventListener("click", ctx.onClose));
    const startEditBtn = root.querySelector('[data-action="start-edit"]');
    if (startEditBtn) startEditBtn.addEventListener("click", ctx.onStartEdit);
    if (ctx.formMode) {
      bindEventFormEvents(root, {
        hass: ctx.hass,
        editingId: ctx.detailsId,
        onSave: ctx.onSave,
        onCancel: ctx.onCancelEdit,
        onDeleteRequest: ctx.onDeleteRequest,
        onDeleteCancel: ctx.onDeleteCancel,
        onDeleteConfirm: ctx.onDeleteConfirm,
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
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
      // Kicks off a fetch for this hass's language the first time it's
      // seen; a no-op once cached (see ensureTranslations()). The callback
      // only fires once per language, right after it first loads - not on
      // every subsequent tick - so this doesn't fight with the render
      // suppression below or wipe in-progress typing.
      ensureTranslations(hass, () => this._render());
      ensureFixedAttributes(hass, () => this._render());
      // Skip re-rendering while a modal is open (add/edit form, import
      // panel, details popup, ...): hass updates fire on *any* entity's
      // state change anywhere in HA, and a full re-render would wipe out
      // whatever the user is currently typing inside it.
      //
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
            .bd-badge { background: var(--primary-color); color: var(--text-primary-color, #fff); border-radius: 12px; padding: 2px 10px; font-size: 12px; font-weight: 600; min-width: 24px; text-align: center; }
            .bd-months { display: grid; grid-template-columns: repeat(${this._config.columns || 3}, 1fr); gap: 6px; margin-bottom: 12px; }
            .bd-month-btn { padding: 8px 4px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; background: var(--secondary-background-color); color: var(--primary-text-color); }
            .bd-month-btn.selected { background: var(--primary-color); color: var(--text-primary-color, #fff); }
            .bd-empty { color: var(--secondary-text-color); font-style: italic; padding: 8px 0; }
            .bd-form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
            .bd-form label { font-size: 12px; color: var(--secondary-text-color); }
            .bd-form input, .bd-form select, .bd-form textarea { padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); font: inherit; }
            .bd-actions { display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap; }
            .bd-attr-row { display: flex; gap: 8px; margin-bottom: 6px; }
            .bd-attr-row input { flex: 1; min-width: 0; }
            .bd-confirm { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; padding: 12px; border-radius: 6px; background: var(--secondary-background-color); }
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
          </style>
          ${headerHtml}
          <div class="bd-body" style="${collapsed ? "display:none;" : ""}">${bodyHtml}</div>
        </ha-card>
      `;
      if (collapsible) {
        this.shadowRoot.querySelector('[data-action="toggle-collapse"]').addEventListener("click", () => {
          this._collapsed = !this._collapsed;
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
      return { title: "Aankomende verjaardagen", days_ahead: 14, event_types: [] };
    }

    constructor() {
      super();
      this._detailsId = null;
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
      const events = getEvents(this._hass, this._config.event_types)
        .filter((e) => e.days <= daysAhead)
        .sort((a, b) => a.days - b.days);

      const rows = events.length
        ? events
            .map(
              (e, i) => css`
              <div class="bd-row" data-action="details" data-id="${e.entity_id.split(".")[1]}">
                <div class="bd-left">
                  ${this._config.show_icon === false ? "" : `<ha-icon icon="${e.icon || EVENT_TYPE_ICONS[e.eventType]}"></ha-icon>`}
                  <div>
                    <div class="bd-name">${e.name}</div>
                    <div class="bd-secondary">${formatDate(e.date)} &middot; ${eventTypeLabel(e.eventType)}${e.eventType !== "deceased" && e.age != null ? ` &middot; ${t("inline_becomes", { age: e.age })}` : ""}</div>
                    ${i === 0 ? `<div class="bd-secondary" id="le-countdown"></div>` : ""}
                  </div>
                </div>
                <div class="bd-badge">${e.days === 0 ? t("countdown_today") : e.days}</div>
              </div>
            `
            )
            .join("")
        : `<div class="bd-empty">${t("upcoming_empty", { days: daysAhead })}</div>`;

      // Looked up from the full, unfiltered event list (not the days_ahead-
      // filtered `events` above) so the popup still works even for an event
      // that's no longer within the window on a later re-render.
      const detailsEvent = this._detailsId
        ? getEvents(this._hass, null).find((e) => e.entity_id.split(".")[1] === this._detailsId)
        : null;

      this._shell(css`
        ${rows}
        ${renderDetailsOrEditModal(detailsEvent, this._formMode, this._confirmDelete)}
      `);

      this.shadowRoot.querySelectorAll('[data-action="details"]').forEach((row) =>
        row.addEventListener("click", () => {
          this._detailsId = row.dataset.id;
          this._formMode = false;
          this._render();
        })
      );
      bindDetailsOrEditModal(this.shadowRoot, {
        hass: this._hass,
        detailsId: this._detailsId,
        formMode: this._formMode,
        onStartEdit: () => {
          this._formMode = true;
          this._render();
        },
        onClose: () => {
          this._detailsId = null;
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
      this._config = config || {};
      // HA's editor dialog echoes our own config-changed events straight
      // back into a fresh setConfig() call. Rebuilding the DOM on that
      // echo (same bug as the hass-render issue elsewhere) would wipe
      // whatever the user is mid-typing on every keystroke.
      if (this._suppressSetConfig) return;
      this._render();
    }
    set hass(hass) {
      this._hass = hass;
      // Fires _render() once, the first time this hass's language finishes
      // loading - not on every tick - so it's safe even though the editor
      // has no other re-render protection (see ensureTranslations()).
      ensureTranslations(hass, () => this._render());
      ensureFixedAttributes(hass, () => this._render());
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
          ${renderEventTypeCheckboxes(this._config.event_types)}
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#days_ahead").addEventListener("input", (e) => this._update({ days_ahead: Number(e.target.value) }));
      this.querySelector("#show_icon").addEventListener("change", (e) => this._update({ show_icon: e.target.checked }));
      this.querySelector("#collapsible").addEventListener("change", (e) => this._update({ collapsible: e.target.checked }));
      bindEventTypeCheckboxes(this, (event_types) => this._update({ event_types }));
    }
    _update(patch) {
      this._config = { ...this._config, ...patch };
      this._suppressSetConfig = true;
      fireEvent(this, "config-changed", { config: this._config });
      Promise.resolve().then(() => { this._suppressSetConfig = false; });
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
      const events = getEvents(this._hass, this._config.event_types);
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
                  <td>${formatDate(e.date)}</td>
                  <td>${e.name}</td>
                  <td><span class="bd-type-badge">${eventTypeLabel(e.eventType)}</span></td>
                  <td>${e.eventType === "deceased" ? "" : e.age ?? ""}</td>
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

      this._shell(css`
        <div class="bd-months">${buttons}</div>
        ${table}
        ${renderDetailsOrEditModal(detailsEvent, this._formMode, this._confirmDelete)}
      `);

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
          this._formMode = false;
          this._render();
        })
      );
      bindDetailsOrEditModal(this.shadowRoot, {
        hass: this._hass,
        detailsId: this._detailsId,
        formMode: this._formMode,
        onStartEdit: () => {
          this._formMode = true;
          this._render();
        },
        onClose: () => {
          this._detailsId = null;
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
      this._config = config || {};
      if (this._suppressSetConfig) return;
      this._render();
    }
    set hass(hass) {
      this._hass = hass;
      ensureTranslations(hass, () => this._render());
      ensureFixedAttributes(hass, () => this._render());
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
          ${renderEventTypeCheckboxes(this._config.event_types)}
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#columns").addEventListener("input", (e) => this._update({ columns: Number(e.target.value) }));
      this.querySelector("#collapsible").addEventListener("change", (e) => this._update({ collapsible: e.target.checked }));
      bindEventTypeCheckboxes(this, (event_types) => this._update({ event_types }));
    }
    _update(patch) {
      this._config = { ...this._config, ...patch };
      this._suppressSetConfig = true;
      fireEvent(this, "config-changed", { config: this._config });
      Promise.resolve().then(() => { this._suppressSetConfig = false; });
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
      ensureTranslations(hass, () => this._render());
      ensureFixedAttributes(hass, () => this._render());
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

    _rowsHtml() {
      const q = this._searchQuery.trim().toLowerCase();
      const anyFilterActive =
        q || this._monthFilter || this._genderFilter || (this._attrFilterKey && this._attrFilterValue);
      if (!anyFilterActive) {
        return `<div class="bd-empty">${t("panel_choose_filter")}</div>`;
      }

      const events = this._baseEvents()
        .filter((e) => !q || e.name.toLowerCase().includes(q))
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
            .map(
              (e) => css`
              <div class="bd-row" data-action="edit" data-id="${e.entity_id.split(".")[1]}">
                <div class="bd-left">
                  <ha-icon icon="${e.icon || EVENT_TYPE_ICONS[e.eventType]}"></ha-icon>
                  <div>
                    <div class="bd-name">${e.name}</div>
                    <div class="bd-secondary">${formatDate(e.date)} &middot; <span class="bd-type-badge">${eventTypeLabel(e.eventType)}</span></div>
                    ${Object.keys(e.attributes).length
                      ? `<div class="bd-secondary">${Object.entries(e.attributes)
                          .map(([k, v]) => `${escapeAttr(k)}: ${escapeAttr(v)}`)
                          .join(" &middot; ")}</div>`
                      : ""}
                  </div>
                </div>
              </div>
            `
            )
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
      list.innerHTML = this._rowsHtml();
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

      const formBody = renderEventFormBody(editing, this._editingId, this._confirmDelete);

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

      const panelBody = css`
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
      this._config = config || {};
      if (this._suppressSetConfig) return;
      this._render();
    }
    set hass(hass) {
      this._hass = hass;
      ensureTranslations(hass, () => this._render());
      ensureFixedAttributes(hass, () => this._render());
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
      bindEventTypeCheckboxes(this, (event_types) => this._update({ event_types }));
      bindFixedAttrsSection(this, this._hass);
    }
    _update(patch) {
      this._config = { ...this._config, ...patch };
      this._suppressSetConfig = true;
      fireEvent(this, "config-changed", { config: this._config });
      Promise.resolve().then(() => { this._suppressSetConfig = false; });
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
