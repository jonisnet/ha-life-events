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
        <div class="bd-form" style="padding:16px;">
          <label>Titel</label>
          <input id="title" value="${this._config.title ?? ""}" />
          <label>Aantal dagen vooruit</label>
          <input id="days_ahead" type="number" min="1" value="${this._config.days_ahead ?? 14}" />
          <label><input id="show_icon" type="checkbox" ${this._config.show_icon !== false ? "checked" : ""} style="width:auto" /> Toon icoon</label>
          <label>Type filter (leeg = alles)</label>
          <select id="event_types" multiple size="3">
            ${["birthday", "anniversary", "deceased"]
              .map(
                (t) =>
                  `<option value="${t}" ${(this._config.event_types || []).includes(t) ? "selected" : ""}>${EVENT_TYPE_LABELS[t]}</option>`
              )
              .join("")}
          </select>
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#days_ahead").addEventListener("input", (e) => this._update({ days_ahead: Number(e.target.value) }));
      this.querySelector("#show_icon").addEventListener("change", (e) => this._update({ show_icon: e.target.checked }));
      this.querySelector("#event_types").addEventListener("change", (e) => {
        const values = Array.from(e.target.selectedOptions).map((o) => o.value);
        this._update({ event_types: values });
      });
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
        <div class="bd-form" style="padding:16px;">
          <label>Titel</label>
          <input id="title" value="${this._config.title ?? ""}" />
          <label>Aantal kolommen (maandknoppen)</label>
          <input id="columns" type="number" min="1" max="6" value="${this._config.columns ?? 3}" />
          <label>Type filter (leeg = alles)</label>
          <select id="event_types" multiple size="3">
            ${["birthday", "anniversary", "deceased"]
              .map(
                (t) =>
                  `<option value="${t}" ${(this._config.event_types || []).includes(t) ? "selected" : ""}>${EVENT_TYPE_LABELS[t]}</option>`
              )
              .join("")}
          </select>
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#columns").addEventListener("input", (e) => this._update({ columns: Number(e.target.value) }));
      this.querySelector("#event_types").addEventListener("change", (e) => {
        const values = Array.from(e.target.selectedOptions).map((o) => o.value);
        this._update({ event_types: values });
      });
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
            <label>Inhoud (plak hier om te importeren, of gebruik Exporteren om te vullen)</label>
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
    }

    async _save() {
      const root = this.shadowRoot;
      const name = root.querySelector("#f-name").value.trim();
      const eventType = root.querySelector("#f-type").value;
      const dateVal = root.querySelector("#f-date").value;
      const dateOfDeath = root.querySelector("#f-date-death").value;
      const icon = root.querySelector("#f-icon").value.trim();

      if (!name || !dateVal) {
        this._status = "Naam en datum zijn verplicht.";
        this._render();
        return;
      }

      const data = { name, event_type: eventType, date: dateVal };
      if (icon) data.icon = icon;
      if (eventType === "deceased" && dateOfDeath) data.date_of_death = dateOfDeath;

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
      const root = this.shadowRoot;
      const format = root.querySelector("#io-format").value;
      const response = await callService(this._hass, "export_events", { format }, true);
      const content = response?.content ?? "";
      if (download) {
        downloadFile(`life-events-export.${format}`, content, format === "json" ? "application/json" : "text/csv");
      } else {
        root.querySelector("#io-content").value = content;
      }
      this._status = "Export klaar.";
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
        <div class="bd-form" style="padding:16px;">
          <label>Titel</label>
          <input id="title" value="${this._config.title ?? ""}" />
          <label>Type filter (leeg = alles)</label>
          <select id="event_types" multiple size="3">
            ${["birthday", "anniversary", "deceased"]
              .map(
                (t) =>
                  `<option value="${t}" ${(this._config.event_types || []).includes(t) ? "selected" : ""}>${EVENT_TYPE_LABELS[t]}</option>`
              )
              .join("")}
          </select>
        </div>
      `;
      this.querySelector("#title").addEventListener("input", (e) => this._update({ title: e.target.value }));
      this.querySelector("#event_types").addEventListener("change", (e) => {
        const values = Array.from(e.target.selectedOptions).map((o) => o.value);
        this._update({ event_types: values });
      });
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
