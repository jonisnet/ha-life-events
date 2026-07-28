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
  console.info("Life Events cards: v1.0.0-beta.4 loaded");

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
  // directly in that markup. They use HA's own ha-textfield/ha-formfield/
  // ha-checkbox/ha-switch elements (already globally registered by the HA
  // frontend) instead of bare <input>/<select>, so they look native
  // instead of like unstyled browser form controls.
  // ---------------------------------------------------------------------
  const EDITOR_STYLE = css`
    <style>
      .le-editor { display: flex; flex-direction: column; gap: 16px; padding: 16px; }
      .le-editor ha-textfield { width: 100%; }
      .le-editor-label { font-size: 12px; color: var(--secondary-text-color); margin-bottom: -8px; }
      .le-editor-types { display: flex; flex-wrap: wrap; gap: 4px 16px; }
    </style>
  `;

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
      this._render();
    }
    set hass(hass) {
      this._hass = hass;
    }
    _render() {
      this.innerHTML = css`
        ${EDITOR_STYLE}
        <div class="le-editor">
          <ha-textfield id="title" label="Titel" value="${this._config.title ?? ""}"></ha-textfield>
          <ha-textfield id="days_ahead" label="Aantal dagen vooruit" type="number" min="1" value="${this._config.days_ahead ?? 14}"></ha-textfield>
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
      this._render();
    }
    set hass(hass) {
      this._hass = hass;
    }
    _render() {
      this.innerHTML = css`
        ${EDITOR_STYLE}
        <div class="le-editor">
          <ha-textfield id="title" label="Titel" value="${this._config.title ?? ""}"></ha-textfield>
          <ha-textfield id="columns" label="Aantal kolommen (maandknoppen)" type="number" min="1" max="6" value="${this._config.columns ?? 3}"></ha-textfield>
          ${renderEventTypeCheckboxes(this._config.event_types)}
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#columns").addEventListener("input", (e) => this._update({ columns: Number(e.target.value) }));
      bindEventTypeCheckboxes(this, (event_types) => this._update({ event_types }));
    }
    _update(patch) {
      this._config = { ...this._config, ...patch };
      fireEvent(this, "config-changed", { config: this._config });
    }
  }

  // ---------------------------------------------------------------------
  // Card 3: Manage (add / edit / delete / import / export)
  // ---------------------------------------------------------------------
  class LifeEventsManageCard extends LifeEventsBaseCard {
    static getStubConfig() {
      return { title: "Verjaardagen beheren", event_types: [] };
    }

    constructor() {
      super();
      this._editingId = null;
      this._formOpen = false;
      this._importOpen = false;
      this._status = "";
    }

    _render() {
      if (!this._hass) return;
      // Kept in sync here (rather than at every _formOpen/_importOpen
      // toggle site) so a later hass update skips re-rendering while the
      // add/edit form or import textarea is open - otherwise every hass
      // tick (any entity changing state, anywhere in HA) would wipe out
      // whatever the user is currently typing.
      this._suppressRender = this._formOpen || this._importOpen;
      const events = getEvents(this._hass, this._config.event_types).sort((a, b) => a.name.localeCompare(b.name));

      const rows = events.length
        ? events
            .map(
              (e) => css`
              <div class="bd-row">
                <div class="bd-left">
                  <ha-icon icon="${e.icon || EVENT_TYPE_ICONS[e.eventType]}"></ha-icon>
                  <div>
                    <div class="bd-name">${e.name}</div>
                    <div class="bd-secondary">${formatDate(e.date)} &middot; <span class="bd-type-badge">${EVENT_TYPE_LABELS[e.eventType] || e.eventType}</span></div>
                  </div>
                </div>
                <div>
                  <button class="bd-icon-btn" data-action="edit" data-id="${e.entity_id.split(".")[1]}">✏️</button>
                  <button class="bd-icon-btn" data-action="delete" data-id="${e.entity_id.split(".")[1]}">🗑️</button>
                </div>
              </div>
            `
            )
            .join("")
        : `<div class="bd-empty">Nog geen gebeurtenissen.</div>`;

      const editing = this._editingId ? events.find((e) => e.entity_id === `${DOMAIN}.${this._editingId}`) : null;

      const form = this._formOpen
        ? css`
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
            <div class="bd-actions">
              <button class="bd-btn" data-action="save">${editing ? "Opslaan" : "Toevoegen"}</button>
              <button class="bd-btn secondary" data-action="cancel">Annuleren</button>
            </div>
          </div>
        `
        : "";

      const importExport = this._importOpen
        ? css`
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
        `
        : "";

      this._shell(css`
        ${rows}
        <div class="bd-actions">
          ${!this._formOpen ? `<button class="bd-btn" data-action="add">+ Toevoegen</button>` : ""}
          ${!this._importOpen ? `<button class="bd-btn secondary" data-action="io">Import / export</button>` : ""}
        </div>
        ${form}
        ${importExport}
        ${this._status ? `<div class="bd-secondary" style="margin-top:8px;">${this._status}</div>` : ""}
      `);

      this._bindEvents();
    }

    _bindEvents() {
      const root = this.shadowRoot;
      root.querySelectorAll('[data-action="edit"]').forEach((btn) =>
        btn.addEventListener("click", () => {
          this._editingId = btn.dataset.id;
          this._formOpen = true;
          this._render();
        })
      );
      root.querySelectorAll('[data-action="delete"]').forEach((btn) =>
        btn.addEventListener("click", async () => {
          if (!confirm("Deze gebeurtenis verwijderen?")) return;
          await callService(this._hass, "delete_event", { event_id: btn.dataset.id });
        })
      );
      const addBtn = root.querySelector('[data-action="add"]');
      if (addBtn)
        addBtn.addEventListener("click", () => {
          this._editingId = null;
          this._formOpen = true;
          this._render();
        });
      const cancelBtn = root.querySelector('[data-action="cancel"]');
      if (cancelBtn)
        cancelBtn.addEventListener("click", () => {
          this._formOpen = false;
          this._editingId = null;
          this._render();
        });
      const saveBtn = root.querySelector('[data-action="save"]');
      if (saveBtn) saveBtn.addEventListener("click", () => this._save());

      const ioBtn = root.querySelector('[data-action="io"]');
      if (ioBtn)
        ioBtn.addEventListener("click", () => {
          this._importOpen = true;
          this._render();
        });
      const closeIoBtn = root.querySelector('[data-action="close-io"]');
      if (closeIoBtn)
        closeIoBtn.addEventListener("click", () => {
          this._importOpen = false;
          this._render();
        });
      const exportBtn = root.querySelector('[data-action="export"]');
      if (exportBtn) exportBtn.addEventListener("click", () => this._export(false));
      const downloadBtn = root.querySelector('[data-action="download"]');
      if (downloadBtn) downloadBtn.addEventListener("click", () => this._export(true));
      const importBtn = root.querySelector('[data-action="import"]');
      if (importBtn) importBtn.addEventListener("click", () => this._import());
      const fileInput = root.querySelector("#io-file");
      if (fileInput) fileInput.addEventListener("change", () => this._loadFile());
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
      this._render();
    }
    set hass(hass) {
      this._hass = hass;
    }
    _render() {
      this.innerHTML = css`
        ${EDITOR_STYLE}
        <div class="le-editor">
          <ha-textfield id="title" label="Titel" value="${this._config.title ?? ""}"></ha-textfield>
          ${renderEventTypeCheckboxes(this._config.event_types)}
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      bindEventTypeCheckboxes(this, (event_types) => this._update({ event_types }));
    }
    _update(patch) {
      this._config = { ...this._config, ...patch };
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
