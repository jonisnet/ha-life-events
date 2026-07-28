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
 */
(() => {
  // Bump alongside manifest.json's version. Check this in the browser
  // console after an update to confirm the fresh file actually loaded,
  // rather than a stale cached copy - see CHANGELOG 1.0.0-beta.4.
  console.info("Life Events cards: v0.0.2-beta.6 loaded");

  const DOMAIN = "life_events";

  const MONTHS_NL = [
    "Januari", "Februari", "Maart", "April", "Mei", "Juni",
    "Juli", "Augustus", "September", "Oktober", "November", "December",
  ];

  const EVENT_TYPE_LABELS = {
    birthday: "Verjaardag",
    anniversary: "Jubileum",
    deceased: "Overleden",
  };

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
    "date_of_death", "phone_number",
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
        attributes: customAttributesOf(st),
      }))
      .filter((e) => !allowed || allowed.includes(e.eventType));
  }

  function formatDate(iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  }

  function monthOf(iso) {
    if (!iso) return null;
    return parseInt(iso.split("-")[1], 10);
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
      <div class="le-editor-label">Type filter (leeg = alles)</div>
      <div class="le-editor-types">
        ${["birthday", "anniversary", "deceased"]
          .map(
            (t) => css`
              <ha-formfield label="${EVENT_TYPE_LABELS[t]}">
                <ha-checkbox data-type="${t}" ${selected.includes(t) ? "checked" : ""}></ha-checkbox>
              </ha-formfield>
            `
          )
          .join("")}
      </div>
    `;
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
      // Skip re-rendering while a form/textarea is open (e.g. the Manage
      // card's add/edit form or import panel): hass updates on every state
      // change anywhere in HA, and a full re-render would wipe out
      // whatever the user is currently typing.
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
      this.shadowRoot.innerHTML = css`
        <ha-card ${title ? `header="${title}"` : ""}>
          <style>
            .bd-body { padding: 0 16px 16px; }
            table.bd-table { width: 100%; border-collapse: collapse; font-size: 14px; }
            table.bd-table th { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--divider-color); color: var(--secondary-text-color); }
            table.bd-table td { padding: 4px 8px; border-bottom: 1px solid var(--divider-color); }
            .bd-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--divider-color); }
            .bd-row:last-child { border-bottom: none; }
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
            .bd-filters { display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
            .bd-filters input, .bd-filters select { padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); font: inherit; }
            .bd-filters input { flex: 1; min-width: 120px; }
            .bd-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 20; padding: 16px; box-sizing: border-box; }
            .bd-modal { background: var(--card-background-color); border-radius: 12px; max-width: 480px; width: 100%; max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
            .bd-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--divider-color); flex-shrink: 0; }
            .bd-modal-title { font-weight: 600; }
            .bd-modal-body { padding: 16px; overflow-y: auto; }
            button.bd-btn { padding: 8px 14px; border-radius: 6px; border: none; cursor: pointer; background: var(--primary-color); color: var(--text-primary-color, #fff); font: inherit; }
            button.bd-btn.secondary { background: var(--secondary-background-color); color: var(--primary-text-color); }
            button.bd-btn.danger { background: var(--error-color, #db4437); color: #fff; }
            .bd-icon-btn { cursor: pointer; background: none; border: none; color: var(--secondary-text-color); font-size: 18px; padding: 4px; }
            .bd-section-title { font-weight: 600; margin: 16px 0 4px; }
            .bd-type-badge { font-size: 11px; padding: 1px 8px; border-radius: 10px; background: var(--secondary-background-color); color: var(--secondary-text-color); }
          </style>
          <div class="bd-body">${bodyHtml}</div>
        </ha-card>
      `;
    }
  }

  // ---------------------------------------------------------------------
  // Card 1: Upcoming list
  // ---------------------------------------------------------------------
  class LifeEventsUpcomingCard extends LifeEventsBaseCard {
    static getStubConfig() {
      return { title: "Aankomende verjaardagen", days_ahead: 14, event_types: [] };
    }

    _render() {
      if (!this._hass) return;
      const daysAhead = this._config.days_ahead ?? 14;
      const events = getEvents(this._hass, this._config.event_types)
        .filter((e) => e.days <= daysAhead)
        .sort((a, b) => a.days - b.days);

      const rows = events.length
        ? events
            .map(
              (e) => css`
              <div class="bd-row">
                <div class="bd-left">
                  ${this._config.show_icon === false ? "" : `<ha-icon icon="${e.icon || EVENT_TYPE_ICONS[e.eventType]}"></ha-icon>`}
                  <div>
                    <div class="bd-name">${e.name}</div>
                    <div class="bd-secondary">${formatDate(e.date)} &middot; ${EVENT_TYPE_LABELS[e.eventType] || e.eventType}${e.eventType !== "deceased" && e.age != null ? ` &middot; wordt ${e.age}` : ""}</div>
                  </div>
                </div>
                <div class="bd-badge">${e.days === 0 ? "Vandaag!" : e.days}</div>
              </div>
            `
            )
            .join("")
        : `<div class="bd-empty">Geen aankomende gebeurtenissen in de komende ${daysAhead} dagen.</div>`;

      this._shell(rows);
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
    }
    _render() {
      this.innerHTML = css`
        ${EDITOR_STYLE}
        <div class="le-editor">
          ${renderEditorField("title", "Titel", this._config.title ?? "")}
          ${renderEditorField("days_ahead", "Aantal dagen vooruit", this._config.days_ahead ?? 14, 'type="number" min="1"')}
          <ha-formfield label="Toon icoon">
            <ha-switch id="show_icon" ${this._config.show_icon !== false ? "checked" : ""}></ha-switch>
          </ha-formfield>
          ${renderEventTypeCheckboxes(this._config.event_types)}
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#days_ahead").addEventListener("input", (e) => this._update({ days_ahead: Number(e.target.value) }));
      this.querySelector("#show_icon").addEventListener("change", (e) => this._update({ show_icon: e.target.checked }));
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
    }

    _render() {
      if (!this._hass) return;
      const events = getEvents(this._hass, this._config.event_types);
      const columns = this._config.columns || 3;

      const buttons = MONTHS_NL.map((label, idx) => {
        const monthNr = idx + 1;
        const count = events.filter((e) => monthOf(e.date) === monthNr).length;
        const selected = monthNr === this._selectedMonth;
        return `<button class="bd-month-btn${selected ? " selected" : ""}" data-month="${monthNr}">${label}${count ? ` (${count})` : ""}</button>`;
      }).join("");

      const monthEvents = events
        .filter((e) => monthOf(e.date) === this._selectedMonth)
        .sort((a, b) => parseInt(a.date.split("-")[2], 10) - parseInt(b.date.split("-")[2], 10));

      const table = monthEvents.length
        ? css`
          <table class="bd-table">
            <tr><th>Datum</th><th>Naam</th><th>Type</th><th>Leeftijd</th></tr>
            ${monthEvents
              .map(
                (e) => css`
                <tr>
                  <td>${formatDate(e.date)}</td>
                  <td>${e.name}</td>
                  <td><span class="bd-type-badge">${EVENT_TYPE_LABELS[e.eventType] || e.eventType}</span></td>
                  <td>${e.eventType === "deceased" ? "" : e.age ?? ""}</td>
                </tr>
              `
              )
              .join("")}
          </table>
        `
        : `<div class="bd-empty">Geen gebeurtenissen in ${MONTHS_NL[this._selectedMonth - 1]}.</div>`;

      this._shell(`<div class="bd-months">${buttons}</div>${table}`);

      this.shadowRoot.querySelectorAll(".bd-month-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          this._selectedMonth = Number(btn.dataset.month);
          this._render();
        });
      });
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
    }
    _render() {
      this.innerHTML = css`
        ${EDITOR_STYLE}
        <div class="le-editor">
          ${renderEditorField("title", "Titel", this._config.title ?? "")}
          ${renderEditorField("columns", "Aantal kolommen (maandknoppen)", this._config.columns ?? 3, 'type="number" min="1" max="6"')}
          ${renderEventTypeCheckboxes(this._config.event_types)}
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#columns").addEventListener("input", (e) => this._update({ columns: Number(e.target.value) }));
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
      if (firstRender) {
        this._render();
      } else if (!this._suppressRender) {
        this._renderList();
      }
    }

    _modalWrap(title, bodyHtml, closeAction) {
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

    // Renders one input-pair row per custom attribute. Purely DOM-driven
    // (like the import/export textarea) rather than tracked in card state -
    // add/remove-row handlers manipulate #f-attrs-rows directly and _save()
    // reads the final rows straight from the DOM, so nothing here ever
    // triggers a full _render() that would wipe in-progress typing.
    _attrRowsHtml(attrs) {
      const entries = Object.entries(attrs || {});
      return entries
        .map(
          ([k, v]) => css`
            <div class="bd-attr-row">
              <input class="f-attr-key" placeholder="Naam (bv. relatie, geslacht)" value="${escapeAttr(k)}" />
              <input class="f-attr-value" placeholder="Waarde" value="${escapeAttr(v)}" />
              <button type="button" class="bd-icon-btn" data-action="remove-attr">✕</button>
            </div>
          `
        )
        .join("");
    }

    _bindAttrRows() {
      const container = this.shadowRoot.querySelector("#f-attrs-rows");
      if (!container) return;
      container.querySelectorAll('[data-action="remove-attr"]').forEach((btn) =>
        btn.addEventListener("click", () => btn.closest(".bd-attr-row").remove())
      );
    }

    // Base list for this card (config's event_types filter only). Used for
    // the editing lookup, independent of the live search/month filter -
    // you're always editing something already visible when you click it.
    _baseEvents() {
      return getEvents(this._hass, this._config.event_types).sort((a, b) => a.name.localeCompare(b.name));
    }

    _rowsHtml() {
      const q = this._searchQuery.trim().toLowerCase();
      const events = this._baseEvents()
        .filter((e) => !q || e.name.toLowerCase().includes(q))
        .filter((e) => !this._monthFilter || monthOf(e.date) === Number(this._monthFilter));

      return events.length
        ? events
            .map(
              (e) => css`
              <div class="bd-row">
                <div class="bd-left">
                  <ha-icon icon="${e.icon || EVENT_TYPE_ICONS[e.eventType]}"></ha-icon>
                  <div>
                    <div class="bd-name">${e.name}</div>
                    <div class="bd-secondary">${formatDate(e.date)} &middot; <span class="bd-type-badge">${EVENT_TYPE_LABELS[e.eventType] || e.eventType}</span></div>
                    ${Object.keys(e.attributes).length
                      ? `<div class="bd-secondary">${Object.entries(e.attributes)
                          .map(([k, v]) => `${escapeAttr(k)}: ${escapeAttr(v)}`)
                          .join(" &middot; ")}</div>`
                      : ""}
                  </div>
                </div>
                <div>
                  <button class="bd-icon-btn" data-action="edit" data-id="${e.entity_id.split(".")[1]}">✏️</button>
                </div>
              </div>
            `
            )
            .join("")
        : `<div class="bd-empty">Geen gebeurtenissen gevonden.</div>`;
    }

    // Targeted update: only replaces the list container, so the search
    // input keeps focus while the user types (same reasoning as
    // _suppressRender - a full _render() here would wipe it).
    _renderList() {
      const list = this.shadowRoot.querySelector("#le-list");
      if (!list) return;
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

      const formBody = css`
        <div class="bd-form">
          <label>Naam</label>
          <input id="f-name" value="${editing ? editing.name : ""}" />
          <label>Type</label>
          <select id="f-type">
            ${["birthday", "anniversary", "deceased"]
              .map(
                (t) =>
                  `<option value="${t}" ${editing && editing.eventType === t ? "selected" : ""}>${EVENT_TYPE_LABELS[t]}</option>`
              )
              .join("")}
          </select>
          <label>Datum</label>
          <input id="f-date" type="date" value="${editing ? editing.date : ""}" />
          <label>Datum van overlijden (alleen bij type 'Overleden')</label>
          <input id="f-date-death" type="date" value="${editing && editing.dateOfDeath ? editing.dateOfDeath : ""}" />
          <label>Icoon (optioneel, bv. mdi:cake)</label>
          <input id="f-icon" value="${editing && editing.icon ? editing.icon : ""}" />
          <label>Telefoonnummer (optioneel, alleen zinvol bij 'Verjaardag'/'Jubileum')</label>
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
                <input id="f-phone-local" style="flex:1;" placeholder="0612345678" value="${phone.local}" />
              `;
            })()}
          </div>
          <label>Aangepaste attributen (optioneel, bv. relatie, geslacht - zelf te bepalen)</label>
          <div id="f-attrs-rows">${this._attrRowsHtml(editing ? editing.attributes : {})}</div>
          <button type="button" class="bd-btn secondary" data-action="add-attr">+ Attribuut toevoegen</button>
          <div class="bd-actions">
            <button class="bd-btn" data-action="save">${editing ? "Opslaan" : "Toevoegen"}</button>
            <button class="bd-btn secondary" data-action="cancel">Annuleren</button>
            ${editing ? `<button class="bd-btn danger" data-action="delete" data-id="${this._editingId}">Verwijderen</button>` : ""}
          </div>
        </div>
      `;

      const importExportBody = css`
        <div class="bd-form">
          <label>Formaat</label>
          <select id="io-format">
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          <label>Modus bij importeren</label>
          <select id="io-mode">
            <option value="merge">Samenvoegen</option>
            <option value="replace">Vervangen</option>
          </select>
          <label>Bestand kiezen (optioneel, vult de inhoud hieronder)</label>
          <input id="io-file" type="file" accept=".json,.csv,application/json,text/csv" />
          <div id="io-file-status" class="bd-secondary"></div>
          <label>Inhoud (plak hier, kies een bestand hierboven, of gebruik Exporteren om te vullen)</label>
          <textarea id="io-content" rows="6"></textarea>
          <div class="bd-actions">
            <button class="bd-btn" data-action="export">Exporteren</button>
            <button class="bd-btn" data-action="download">Download bestand</button>
            <button class="bd-btn secondary" data-action="import">Importeren</button>
            <button class="bd-btn secondary" data-action="close-io">Sluiten</button>
          </div>
        </div>
      `;

      const panelBody = css`
        <div class="bd-filters">
          <input id="f-search" placeholder="Zoek op naam..." value="${this._searchQuery}" />
          <select id="f-month-filter">
            <option value="">Alle maanden</option>
            ${MONTHS_NL.map(
              (m, i) => `<option value="${i + 1}" ${Number(this._monthFilter) === i + 1 ? "selected" : ""}>${m}</option>`
            ).join("")}
          </select>
        </div>
        <div class="bd-actions">
          ${!this._formOpen ? `<button class="bd-btn" data-action="add">+ Toevoegen</button>` : ""}
          ${!this._importOpen ? `<button class="bd-btn secondary" data-action="io">Import / export</button>` : ""}
        </div>
        <div id="le-list">${this._rowsHtml()}</div>
        ${this._status ? `<div class="bd-secondary" style="margin-top:8px;">${this._status}</div>` : ""}
      `;

      const mainHtml = isButtonMode
        ? this._panelOpen
          ? ""
          : css`<button class="bd-btn" data-action="open-panel">Beheer openen</button>`
        : panelBody;

      this._shell(css`
        ${mainHtml}
        ${isButtonMode && this._panelOpen ? this._modalWrap(this._config.title || "Beheren", panelBody, "close-panel") : ""}
        ${this._formOpen ? this._modalWrap(editing ? "Bewerken" : "Toevoegen", formBody, "cancel") : ""}
        ${this._importOpen ? this._modalWrap("Import / export", importExportBody, "close-io") : ""}
      `);

      this._bindEvents();
      this._bindFilterEvents();
      this._bindModalBackdrops();
    }

    _bindEvents() {
      const root = this.shadowRoot;
      this._bindListEvents();
      const addBtn = root.querySelector('[data-action="add"]');
      if (addBtn)
        addBtn.addEventListener("click", () => {
          this._editingId = null;
          this._formOpen = true;
          this._render();
        });
      // querySelectorAll: the modal header's close (X) button reuses the
      // same data-action as the body's own Annuleren/Sluiten button, so
      // there are two matching elements to bind whenever a modal is open.
      root.querySelectorAll('[data-action="cancel"]').forEach((btn) =>
        btn.addEventListener("click", () => {
          this._formOpen = false;
          this._editingId = null;
          this._render();
        })
      );
      const saveBtn = root.querySelector('[data-action="save"]');
      if (saveBtn) saveBtn.addEventListener("click", () => this._save());
      const deleteBtn = root.querySelector('[data-action="delete"]');
      if (deleteBtn)
        deleteBtn.addEventListener("click", async () => {
          if (!confirm("Deze gebeurtenis verwijderen?")) return;
          await callService(this._hass, "delete_event", { event_id: deleteBtn.dataset.id });
          this._formOpen = false;
          this._editingId = null;
          this._render();
        });

      this._bindAttrRows();
      const addAttrBtn = root.querySelector('[data-action="add-attr"]');
      if (addAttrBtn)
        addAttrBtn.addEventListener("click", () => {
          // Direct DOM append, not _render(): this popup can be mid-edit
          // (name/date/etc. typed but not saved yet), and a full re-render
          // would wipe all of that the same way the earlier typing bugs did.
          const container = root.querySelector("#f-attrs-rows");
          if (!container) return;
          container.insertAdjacentHTML("beforeend", this._attrRowsHtml({ "": "" }));
          const newRow = container.lastElementChild;
          const removeBtn = newRow.querySelector('[data-action="remove-attr"]');
          if (removeBtn) removeBtn.addEventListener("click", () => newRow.remove());
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
    }

    // Clicking outside the modal box closes it, by delegating to the
    // already-bound header close button - avoids duplicating each modal's
    // close logic here.
    _bindModalBackdrops() {
      this.shadowRoot.querySelectorAll(".bd-modal-backdrop").forEach((backdrop) => {
        backdrop.addEventListener("click", (e) => {
          if (e.target !== backdrop) return;
          const closeBtn = backdrop.querySelector(".bd-modal-header [data-action]");
          if (closeBtn) closeBtn.click();
        });
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
        statusEl.textContent = `Bestand '${file.name}' geladen. Controleer de inhoud en klik op Importeren.`;
      };
      reader.onerror = () => {
        statusEl.textContent = `Kon '${file.name}' niet lezen.`;
      };
      reader.readAsText(file);
    }

    async _save() {
      const root = this.shadowRoot;
      const name = root.querySelector("#f-name").value.trim();
      const eventType = root.querySelector("#f-type").value;
      const dateVal = root.querySelector("#f-date").value;
      const dateOfDeath = root.querySelector("#f-date-death").value;
      const icon = root.querySelector("#f-icon").value.trim();
      const phoneCountry = root.querySelector("#f-phone-country").value;
      const phoneLocal = root.querySelector("#f-phone-local").value.trim();

      if (!name || !dateVal) {
        this._status = "Naam en datum zijn verplicht.";
        this._render();
        return;
      }

      const data = { name, event_type: eventType, date: dateVal };
      if (icon) data.icon = icon;
      if (eventType === "deceased" && dateOfDeath) data.date_of_death = dateOfDeath;
      // Only meaningful for birthday/anniversary; clears any previously set
      // number if the type was switched to deceased or the field was emptied.
      data.phone_number = PHONE_EVENT_TYPES.includes(eventType) && phoneLocal ? toE164(phoneLocal, phoneCountry) : "";
      // Always included (even {}), so removing every row actually clears
      // previously stored attributes - update_event replaces this field
      // wholesale rather than merging it key by key (see manager.py).
      const attributes = {};
      root.querySelectorAll("#f-attrs-rows .bd-attr-row").forEach((row) => {
        const key = row.querySelector(".f-attr-key").value.trim();
        const value = row.querySelector(".f-attr-value").value.trim();
        if (key) attributes[key] = value;
      });
      data.attributes = attributes;

      if (this._editingId) {
        await callService(this._hass, "update_event", { event_id: this._editingId, ...data });
      } else {
        await callService(this._hass, "add_event", data);
      }

      this._formOpen = false;
      this._editingId = null;
      this._status = "Opgeslagen.";
      this._render();
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
      root.querySelector("#io-file-status").textContent = "Export klaar.";
    }

    async _import() {
      const root = this.shadowRoot;
      const format = root.querySelector("#io-format").value;
      const mode = root.querySelector("#io-mode").value;
      const content = root.querySelector("#io-content").value;
      if (!content.trim()) {
        this._status = "Niets om te importeren.";
        this._render();
        return;
      }
      const response = await callService(this._hass, "import_events", { content, format, mode }, true);
      this._status = `Geïmporteerd: ${response?.imported ?? 0} gebeurtenissen.`;
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
    }
    _render() {
      this.innerHTML = css`
        ${EDITOR_STYLE}
        <div class="le-editor">
          ${renderEditorField("title", "Titel", this._config.title ?? "")}
          ${renderEditorSelect(
            "display_mode",
            "Weergave",
            [
              ["full", "Volledige kaart"],
              ["button", "Knop die als popup opent"],
            ],
            this._config.display_mode || "full"
          )}
          ${renderEventTypeCheckboxes(this._config.event_types)}
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#display_mode").addEventListener("change", (e) => this._update({ display_mode: e.target.value }));
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
  // Registration
  // ---------------------------------------------------------------------
  customElements.define("life-events-upcoming-card", LifeEventsUpcomingCard);
  customElements.define("life-events-upcoming-card-editor", LifeEventsUpcomingCardEditor);
  customElements.define("life-events-month-card", LifeEventsMonthCard);
  customElements.define("life-events-month-card-editor", LifeEventsMonthCardEditor);
  customElements.define("life-events-manage-card", LifeEventsManageCard);
  customElements.define("life-events-manage-card-editor", LifeEventsManageCardEditor);

  window.customCards = window.customCards || [];
  window.customCards.push(
    {
      type: "life-events-upcoming-card",
      name: "Life Events: Upcoming",
      description: "Lijst van aankomende verjaardagen, jubilea en herdenkingen.",
    },
    {
      type: "life-events-month-card",
      name: "Life Events: Month overview",
      description: "Maandknoppen + tabel, zoals het originele verjaardagen-dashboard.",
    },
    {
      type: "life-events-manage-card",
      name: "Life Events: Manage",
      description: "Toevoegen, bewerken, verwijderen, importeren en exporteren.",
    }
  );
})();
