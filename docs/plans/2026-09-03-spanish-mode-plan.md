# Spanish Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give Aurora Events a Spanish mode — auto-detected for Spanish-language browsers on first visit, switchable anytime via a header ES/EN toggle — translating all UI chrome, categories, dates, and empty states while leaving event content (titles/descriptions/venues, source-owned English) untouched.

**Architecture:** Pure frontend, zero-build. A new `i18n.js` (loaded before `app.js`) holds `window.I18N = { en: {…}, es: {…} }` — every user-facing string in both languages, plus an `es.categories` display map. Static HTML elements carry `data-i18n` / `data-i18n-placeholder` / `data-i18n-aria` / `data-i18n-cat` attributes; dynamic renders call the `t(key, vars)` / `catLabel(raw)` helpers added to `app.js`. Language state mirrors the theme pattern: `auroraevents.lang` in localStorage (`"en"`|`"es"`), `<html lang>` attribute switched. Canonical English identifiers (bucket names, raw categories, `<option>` values) never change — only display is translated. `data/events.json` and all pipeline scripts are untouched.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework). No test framework exists in the repo, so each task's verification steps are syntax checks plus served-page / headless-browser assertions (see Task 7 for the browser commands). Work happens on `main` in `D:\Event_Calendar` (repo convention — the prior dashboard redesign ran the same way).

**Design doc:** `docs/plans/2026-09-03-spanish-mode-design.md` (approved).

**Decision log (from design doc):**
- Translate UI + categories only; event titles/descriptions/venues stay source English (no machine translation anywhere).
- First visit: `navigator.language` starts with `es` → Spanish; else English. Choice persists; header toggle always available.
- Dialect: es-MX-leaning Latin American copy; Intl locale `es-MX` for dates/numbers in Spanish mode, `en-US` in English mode (UI language and date language always agree).
- Translation storage: `i18n.js` dictionary + `data-i18n` attributes + `t()`; no fetches.
- Internal identifiers stay canonical English; `dataset.category`/`activeCategory`/bucket keys unchanged.
- GitHub payloads (issue/PR bodies) stay English.

---

### Task 1: Create `i18n.js` — full en/es dictionary

**Files:**
- Create: `i18n.js`

**Step 1: Write the file**

Every user-facing string currently in `index.html` and `app.js`, in both languages. English values are byte-identical to today's copy so English mode renders unchanged. Key naming is semantic; bucket keys are `"bucket." + canonicalLabel`; plural strings are `{one, other}` objects consumed by `t()` with a `count` var.

```js
// i18n.js — every user-facing string for Aurora Events, in both supported
// languages. Loaded BEFORE app.js (plain script, no fetch). Canonical keys
// are English; internal identifiers (bucket names, raw categories, <option>
// values) never change — only display is translated.
//
// Dialect: es-MX-leaning Latin American Spanish (ustedes-form). Event
// content (titles/descriptions/venues) is source-owned and NEVER translated
// here. To add a string: add the key to BOTH language objects with identical
// English copy to today's UI text.
window.I18N = {
  en: {
    "meta.title": "Aurora Events — Local Events Calendar",
    "meta.description":
      "A privacy-first, serverless local events calendar for Aurora, IL, refreshed twice daily via GitHub Actions from a hybrid ICS/JSON-LD/HTML/API ingestion pipeline.",

    "brand.subtitle": "Local Events Calendar — Refreshed 6:00 AM & 5:30 PM CDT",
    "brand.beta": "(BETA - Under Construction)",
    "nav.propose": "Propose a Source",

    "theme.toggleAria": "Toggle dark/light theme",
    "lang.toggleAria": "Switch to Spanish",

    "panel.title": "Propose an Event Source",
    "panel.closeAria": "Close panel",
    "panel.urlLabel": "Source URL (calendar page, ICS feed, or RSS/Atom feed)",
    "panel.urlPlaceholder": "e.g. https://example.org/events/",
    "panel.venueLabel": "Venue / Organization Name",
    "panel.venuePlaceholder": "e.g. The Venue",
    "panel.typeLabel": "Source Type",
    "panel.categoryLabel": "Category",
    "type.html": "HTML Calendar Page",
    "type.jsonld": "JSON-LD Event Page",
    "type.ics": "ICS / iCal Feed",
    "type.rss": "RSS / Atom Feed",
    "btn.ghIssue": "Submit Issue on GitHub",
    "btn.ghPr": "1-Click PR (Edit sources.json)",
    "btn.localQueue": "Save in Browser Only",
    "btn.copyJson": "Copy JSON Snippet",
    "btn.copied": "Copied!",

    "controls.categoriesAria": "Event Categories",
    "tabs.all": "All Events",
    "search.placeholder": "Filter by keyword, venue, source...",
    "search.aria": "Filter events",
    "search.clearAria": "Clear filter",
    "status.loading": "Fetching latest events snapshot…",

    "featured.aria": "Featured event",
    "featured.badge": "FEATURED",
    "featured.desc":
      "After-dark nightlife at Quantum Prairie — the craft-cocktail lounge inside Two Brothers Roundhouse in downtown Aurora.",
    "featured.cta": "View listing on Eventbrite ↗",

    "bucket.Today": "Today",
    "bucket.Tomorrow": "Tomorrow",
    "bucket.This Week": "This Week",
    "bucket.Later": "Later",
    "bucket.Unconfirmed Date": "Unconfirmed Date",
    "section.count": { one: "1 event", other: "{count} events" },
    "overflow.more": "{count} more {bucket} events",

    "confidence.low": "Unconfirmed — verify at source",
    "confidence.medium": "Community-sourced",
    "event.via": "via {source}",
    "event.dateUnknown": "Date unknown",

    "queue.badge": "queued in browser",
    "queue.note":
      "Saved locally. Click 'Propose a Source' above to submit a GitHub Issue or PR to include it in official runs.",
    "queue.remove": "✕ Remove",
    "queue.heading": "Proposed Sources (pending review)",

    "empty.title": "No events found",
    "empty.hint": "Try clearing your filter or selecting another category tab.",

    "footer.refresh": "Last refresh: {date}",
    "footer.sourcesLive": " · {ok}/{total} sources live",
    "footer.pending": "Background data pending.",
    "footer.blurb":
      "Open source, zero-tracking local events calendar. A hybrid ICS/JSON-LD/HTML/API pipeline runs twice daily via GitHub Actions and commits results to static JSON.",
    "footer.repo": "GitHub Repository",
    "footer.sources": "View Data Sources",
    "footer.sponsor":
      "Sponsored by Global Data Sciences, Inc Aurora, IL - an Aurora company acting globally since 2007.",

    "alert.url": "Please enter a valid http(s) URL.",
    "alert.copied":
      'Copied JSON snippet for "{label}" to clipboard!\nOpening GitHub file editor...'
  },

  es: {
    "meta.title": "Aurora Events — Calendario de eventos locales",
    "meta.description":
      "Un calendario local de eventos de código abierto y sin rastreo para Aurora, IL, actualizado dos veces al día mediante GitHub Actions desde un proceso híbrido de ingesta ICS/JSON-LD/HTML/API.",

    "brand.subtitle": "Calendario de eventos locales — Actualizado 6:00 a. m. y 5:30 p. m. CDT",
    "brand.beta": "(BETA — En construcción)",
    "nav.propose": "Proponer una fuente",

    "theme.toggleAria": "Alternar tema oscuro/claro",
    "lang.toggleAria": "Cambiar a inglés",

    "panel.title": "Proponer una fuente de eventos",
    "panel.closeAria": "Cerrar panel",
    "panel.urlLabel": "URL de la fuente (página de calendario, feed ICS o feed RSS/Atom)",
    "panel.urlPlaceholder": "p. ej. https://example.org/events/",
    "panel.venueLabel": "Lugar / Nombre de la organización",
    "panel.venuePlaceholder": "p. ej. Paramount Theatre",
    "panel.typeLabel": "Tipo de fuente",
    "panel.categoryLabel": "Categoría",
    "type.html": "Página HTML de calendario",
    "type.jsonld": "Página de evento JSON-LD",
    "type.ics": "Feed ICS / iCal",
    "type.rss": "Feed RSS / Atom",
    "btn.ghIssue": "Enviar propuesta en GitHub",
    "btn.ghPr": "PR en 1 clic (Editar sources.json)",
    "btn.localQueue": "Guardar solo en el navegador",
    "btn.copyJson": "Copiar fragmento JSON",
    "btn.copied": "¡Copiado!",

    "controls.categoriesAria": "Categorías de eventos",
    "tabs.all": "Todos los eventos",
    "search.placeholder": "Filtrar por palabra clave, lugar, fuente...",
    "search.aria": "Filtrar eventos",
    "search.clearAria": "Borrar filtro",
    "status.loading": "Cargando los eventos más recientes…",

    "featured.aria": "Evento destacado",
    "featured.badge": "DESTACADO",
    "featured.desc":
      "Vida nocturna en Quantum Prairie, el lounge de cócteles artesanales dentro de Two Brothers Roundhouse, en el centro de Aurora.",
    "featured.cta": "Ver evento en Eventbrite ↗",

    "bucket.Today": "Hoy",
    "bucket.Tomorrow": "Mañana",
    "bucket.This Week": "Esta semana",
    "bucket.Later": "Más adelante",
    "bucket.Unconfirmed Date": "Fecha sin confirmar",
    "section.count": { one: "1 evento", other: "{count} eventos" },
    "overflow.more": "Ver {count} eventos más de {bucket}",

    "confidence.low": "Sin confirmar — verificar en la fuente",
    "confidence.medium": "Fuente comunitaria",
    "event.via": "vía {source}",
    "event.dateUnknown": "Fecha desconocida",

    "queue.badge": "guardado en el navegador",
    "queue.note":
      "Guardado localmente. Haz clic en «Proponer una fuente» para enviar un Issue o PR de GitHub e incluirlo en las ejecuciones oficiales.",
    "queue.remove": "✕ Quitar",
    "queue.heading": "Fuentes propuestas (en revisión)",

    "empty.title": "No se encontraron eventos",
    "empty.hint": "Prueba borrar el filtro o selecciona otra pestaña de categoría.",

    "footer.refresh": "Última actualización: {date}",
    "footer.sourcesLive": " · {ok}/{total} fuentes activas",
    "footer.pending": "Datos pendientes de carga.",
    "footer.blurb":
      "Calendario local de eventos de código abierto y sin rastreo. Un proceso híbrido ICS/JSON-LD/HTML/API se ejecuta dos veces al día mediante GitHub Actions y publica los resultados en JSON estático.",
    "footer.repo": "Repositorio de GitHub",
    "footer.sources": "Ver fuentes de datos",
    "footer.sponsor":
      "Patrocinado por Global Data Sciences, Inc., Aurora, IL: una empresa de Aurora que actúa globalmente desde 2007.",

    "alert.url": "Ingresa una URL http(s) válida.",
    "alert.copied":
      'Fragmento JSON de «{label}» copiado al portapapeles.\nAbriendo el editor de archivos de GitHub...',

    // Display labels for raw event-category values (tabs, badges, form
    // options). Unknown categories fall back to the raw English label via
    // catLabel(). English needs no map — raw values ARE the English labels.
    categories: {
      "Civic": "Cívico",
      "Civic Meetings": "Reuniones cívicas",
      "Club / Social": "Club / Social",
      "Commerce": "Comercio",
      "Community": "Comunidad",
      "Education": "Educación",
      "Entertainment": "Entretenimiento",
      "Faith": "Fe",
      "General": "General",
      "Live Music": "Música en vivo",
      "News Mentions": "Menciones en noticias",
      "Parks & Rec": "Parques y recreación",
      "Retail": "Comercio minorista"
    }
  }
};
```

**Step 2: Verify syntax**

Run: `node --check i18n.js`
Expected: no output, exit 0 (parses as valid script).

**Step 3: Commit**

```bash
git add i18n.js
git commit -m "feat: i18n dictionary (en/es) for Spanish mode"
```

---

### Task 2: `app.js` — language core (state, detect, toggle, t/catLabel, locale)

**Files:**
- Modify: `app.js:3` (constants), `app.js:23-46` (DOM lookups), `app.js:47-51` (state), `app.js:52-68` (new section after theme), `app.js:202-213` (`formatDate` locale), `app.js:251-272` (`formatEventDate` locale), `app.js:643-647` (`init`)

**Step 1: Add the language constant** — after line 3 (`const THEME_KEY = ...`):

```js
const LANG_KEY = "auroraevents.lang";
```

**Step 2: Add the toggle DOM lookup** — after the `themeToggle` lookup (line 27):

```js
const langToggle = document.getElementById("lang-toggle");
```

**Step 3: Add language state** — next to `let activeCategory` / `let filterQuery` (lines 49-50):

```js
let activeLang = "en";
```

**Step 4: Insert the language-management section** — immediately after the closing brace of `initTheme()` (line 68), before `// 2. Repository Link Helper`:

```js
// 1b. Language Management (Spanish mode). Mirrors the theme pattern:
// localStorage choice + instant re-render; html lang stays in sync.
const SUPPORTED_LANGS = ["en", "es"];
const UI_LOCALES = { en: "en-US", es: "es-MX" };

function detectLanguage() {
  return (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en";
}

function uiLocale() {
  return UI_LOCALES[activeLang] || "en-US";
}

// Current-language string lookup: es → en → raw key (never empty, never
// throws). Plural objects use {one, other} keyed off vars.count. {var}
// placeholders substitute from vars.
function t(key, vars = {}) {
  const dict = I18N[activeLang] || {};
  const en = I18N.en || {};
  let val = dict[key] ?? en[key] ?? key;
  if (val && typeof val === "object") val = vars.count === 1 ? val.one : val.other;
  return String(val ?? key).replace(/\{(\w+)\}/g, (m, name) =>
    name in vars ? String(vars[name]) : m
  );
}

// Display label for a raw event-category value. English needs no map (raw
// values ARE the labels); unknown categories fall back to raw — future
// categories can never break the UI.
function catLabel(raw) {
  const map = (I18N[activeLang] || {}).categories || {};
  return map[raw] || raw;
}

// Applies the active language to everything static: html lang, <title>, meta
// description, [data-i18n*] elements, and the ES/EN toggle button itself
// (the button always shows the TARGET language).
function applyStaticI18n() {
  document.documentElement.lang = activeLang;
  document.title = t("meta.title");
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.content = t("meta.description");

  for (const el of document.querySelectorAll("[data-i18n]")) {
    el.textContent = t(el.dataset.i18n);
  }
  for (const el of document.querySelectorAll("[data-i18n-placeholder]")) {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  }
  for (const el of document.querySelectorAll("[data-i18n-cat]")) {
    el.textContent = catLabel(el.dataset.i18nCat);
  }
  for (const el of document.querySelectorAll("[data-i18n-aria]")) {
    const label = t(el.dataset.i18nAria);
    el.setAttribute("aria-label", label);
    el.title = label;
  }
  if (langToggle) {
    const target = activeLang === "es" ? "EN" : "ES";
    const aria = t("lang.toggleAria");
    langToggle.textContent = target;
    langToggle.setAttribute("aria-label", aria);
    langToggle.title = aria;
  }
}

// Full re-apply after a manual toggle (static copy + all dynamic renders).
function applyLanguage() {
  applyStaticI18n();
  renderCategoryTabs();
  renderDashboard();
}

function initLanguage() {
  // First decision is sticky: auto-detect once, persist it. A later browser
  // language change must never yank the UI; the header toggle is the escape
  // hatch. Corrupt/absent stored values fall through to detection.
  const stored = localStorage.getItem(LANG_KEY);
  activeLang = SUPPORTED_LANGS.includes(stored) ? stored : detectLanguage();
  localStorage.setItem(LANG_KEY, activeLang);

  if (langToggle) {
    langToggle.addEventListener("click", () => {
      activeLang = activeLang === "es" ? "en" : "es";
      localStorage.setItem(LANG_KEY, activeLang);
      applyLanguage();
    });
  }
  // Static-only here: the dashboard renders later in init() after the fetch,
  // so we never flash an empty state before data arrives.
  applyStaticI18n();
}
```

**Step 5: Make date formatting locale-aware**

In `formatDate` (line 206) change `d.toLocaleString(undefined, {` to `d.toLocaleString(uiLocale(), {`. In `formatEventDate`, change both `start.toLocaleDateString(undefined, dateOpts)` and `start.toLocaleTimeString(undefined, timeOpts)` (lines 258/262) to pass `uiLocale()` instead of `undefined`, and the same for the end-time calls at lines 267 (both `toLocaleTimeString` and `toLocaleDateString` there). Leave `chicagoParts` alone (line 217) — it only extracts numeric Y/M/D, locale-independent.

**Step 6: Wire into init()**

At the top of `init()` (line 644), before `initTheme();`, add:

```js
initLanguage();
```

**Step 7: Verify syntax**

Run: `node --check app.js`
Expected: no output, exit 0. (At this point nothing calls `t()` yet except `applyStaticI18n` internals, and no `[data-i18n]` elements exist — `applyStaticI18n` must be a safe no-op. Task 3 adds the attributes.)

**Step 8: Commit**

```bash
git add app.js
git commit -m "feat: language core — auto-detect, ES/EN toggle state, t()/catLabel(), locale-aware dates"
```

---

### Task 3: `index.html` — data-i18n attributes, lang-toggle button, script order

**Files:**
- Modify: `index.html` (throughout) + header-actions + script tags

**Step 1: Read the current file** to confirm it matches `index.html:1-199` of the design-era tree (unchanged since commit `94bff35`).

**Step 2: Apply the full set of edits**

The diff is large but mechanical — every user-facing text node gets an attribute, no text is removed (English copy stays the initial content; `applyStaticI18n` overwrites it when the page loads). Work top to bottom:

1. `<html lang="en" data-theme="dark">` — keep `lang="en"` as the no-JS fallback (JS flips it on load when Spanish is chosen).
2. `<title>` — keep text; JS sets it at load via `t("meta.title")`. Leave the `<meta name="description">` content likewise (JS overwrites).
3. Subtitle paragraph (lines 21-24): wrap the two strings in spans so the beta badge can translate separately:
   ```html
   <p class="subtitle">
     <span data-i18n="brand.subtitle">Local Events Calendar — Refreshed 6:00 AM &amp; 5:30 PM CDT</span>
     <span class="beta-badge" role="note" data-i18n="brand.beta">(BETA - Under Construction)</span>
   </p>
   ```
4. "Propose a Source" button (line 30): add `data-i18n="nav.propose"` to the text node — simplest is to wrap the text in a `<span data-i18n="nav.propose">Propose a Source</span>` inside the button (keeps the SVG icon).
5. Theme toggle (line 32): add `data-i18n-aria="theme.toggleAria"` and remove the now-redundant literal `aria-label`/`title`.
6. Insert the language toggle button BEFORE the theme toggle inside `.header-actions` (line 32):
   ```html
   <button id="lang-toggle" class="lang-toggle-btn" type="button" aria-label="Switch to Spanish" title="Switch to Spanish">ES</button>
   ```
7. Submit panel (lines 40-104):
   - h2 (43): `data-i18n="panel.title"`
   - close button (44): `data-i18n-aria="panel.closeAria"` (remove literal aria-label)
   - URL label (49): `data-i18n="panel.urlLabel"`
   - URL input (50-55): add `data-i18n-placeholder="panel.urlPlaceholder"`
   - Venue label (58): `data-i18n="panel.venueLabel"`
   - Venue input (59): add `data-i18n-placeholder="panel.venuePlaceholder"`
   - "Source Type" label (64): `data-i18n="panel.typeLabel"`
   - Type options (66-69): `data-i18n="type.html"` / `"type.jsonld"` / `"type.ics"` / `"type.rss"`
   - "Category" label (73): `data-i18n="panel.categoryLabel"`
   - Category options (75-83): add `data-i18n-cat="Civic"` etc. matching each option's `value` (Civic, Entertainment, Live Music, Faith, Retail, Parks &amp; Rec, Education, Community, General)
   - Action buttons (88-100): wrap text in `<span data-i18n="btn.ghIssue">…</span>` etc. for `btn.ghIssue` / `btn.ghPr` / `btn.localQueue` / `btn.copyJson`
8. Controls bar: nav (111) `data-i18n-aria="controls.categoriesAria"`; All Events tab button (112): `data-i18n="tabs.all"`; search input (120-125): add `data-i18n-placeholder="search.placeholder"` and `data-i18n-aria="search.aria"` (keep the literal attrs too — JS overwrites); clear button (126): `data-i18n-aria="search.clearAria"`.
9. Status card (135): `data-i18n="status.loading"`.
10. Featured section (139-159):
    - section (139): `data-i18n-aria="featured.aria"`
    - FEATURED badge (142): `data-i18n="featured.badge"`
    - Entertainment badge (143): `data-i18n-cat="Entertainment"`
    - title h2 (145) and meta p (150): NOT tagged (proper nouns, stay as-is)
    - desc p (146-149): `data-i18n="featured.desc"` (inner text becomes the dictionary sentence)
    - CTA (151-158): add `data-i18n="featured.cta"`; the `&nbsp;↗` inside becomes plain text `View listing on Eventbrite&nbsp;↗` — replace the text node so the whole thing is one text node the attribute can overwrite:
      ```html
      View listing on Eventbrite ↗
      ```
11. Footer (167-195):
    - blurb p (171-174): `data-i18n="footer.blurb"`
    - repo link (179): `data-i18n="footer.repo"`
    - sources link (181): `data-i18n="footer.sources"`
    - sponsor link (186-193): `data-i18n="footer.sponsor"`
12. Scripts (197-198): add `i18n.js` BEFORE `app.js`:
    ```html
    <script src="i18n.js"></script>
    <script src="app.js"></script>
    ```

Notes:
- `data-i18n-cat` on `<option>`s resolves through `catLabel(raw)` where `raw` is the option's `value` — `dataset.category`/form values never change, so submission logic is untouched.
- `renderCategoryTabs()` rebuilds the tabs container on every render, so the static All-Events button (step 8) is only the no-JS initial paint; Task 4 makes the JS renderer translate too.

**Step 3: Verify attributes landed**

Run:

```powershell
$html = Get-Content index.html -Raw
"data-i18n count: " + ([regex]::Matches($html, 'data-i18n="')).Count
"data-i18n-cat count: " + ([regex]::Matches($html, 'data-i18n-cat="')).Count
"lang-toggle: " + $html.Contains('id="lang-toggle"')
"i18n.js before app.js: " + ($html.IndexOf('src="i18n.js"') -lt $html.IndexOf('src="app.js"'))
```

Expected: data-i18n ≥ 30, data-i18n-cat ≥ 10 (9 options + featured badge), lang-toggle True, script order True.

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: data-i18n static copy, ES/EN header toggle button"
```

---

### Task 4: `app.js` — route dynamic renders through t()/catLabel, Spanish-aware search

**Files:**
- Modify: `app.js` (multiple render functions)

**Step 1: `formatEventDate` date-unknown strings** (lines 252/254) — two returns of `"Date unknown"` become `return t("event.dateUnknown");`.

**Step 2: `renderSectionHeading` (317-332)** — heading name and count chip:

```js
name.textContent = t("bucket." + label);
...
chip.textContent = t("section.count", { count: total });
```

**Step 3: `renderOverflowMenu` trigger label (350-352)**:

```js
triggerLabel.textContent = t("overflow.more", {
  count: overflowEvents.length,
  bucket: t("bucket." + sectionLabel),
});
```

**Step 4: `renderCategoryTabs` (454-467)** — the All button and per-category buttons:

```js
allBtn.textContent = t("tabs.all");
...
btn.textContent = catLabel(cat);
```

**Step 5: `renderEventCard`** — confidence badge (505) and source row (532):

```js
confTag.textContent = t(event.confidence === "low" ? "confidence.low" : "confidence.medium");
...
sourceRow.textContent = t("event.via", { source: event.sourceLabel });
```

**Step 6: `renderQueuedSourceCard`** (546/563/569) — badge, note, remove button:

```js
tag.textContent = t("queue.badge");
...
p.textContent = t("queue.note");
...
removeBtn.textContent = t("queue.remove");
```

**Step 7: `renderDashboard`** — proposed-sources heading (626) and empty state (634-639):

```js
heading.textContent = t("queue.heading");
...
emptyCard.innerHTML = `<h3>${t("empty.title")}</h3><p>${t("empty.hint")}</p>`;
```

**Step 8: Spanish-aware search (588-597)** — match the raw English fields plus BOTH the raw and translated category, so typing "música" finds Live Music events:

```js
if (filterQuery) {
  const q = filterQuery.toLowerCase();
  events = events.filter((e) =>
    [e.title, e.venue, e.sourceLabel, e.category, catLabel(e.category)]
      .filter(Boolean)
      .some((f) => f.toLowerCase().includes(q))
  );
}
```

(In English mode `catLabel` is the identity, so behavior is today's behavior plus a harmless superset.)

**Step 9: Submit-flow strings** (`initSubmitPanel`, lines 117/133/139/153-154) — alerts and the copy button label:

```js
alert(t("alert.url"));
...
alert(t("alert.copied", { label: sourceObj.label }));
...
btnCopyJson.textContent = t("btn.copied");
setTimeout(() => (btnCopyJson.textContent = t("btn.copyJson")), 1800);
```

(The GitHub issue/PR bodies at lines 121-125/138-143 stay English — canonical format for maintainers, per design.)

**Step 10: Footer status line in `init()` (676-683)**:

```js
if (rawEventsData.generatedAt) {
  const statuses = rawEventsData.sourceStatus || [];
  const okCount = statuses.filter((s) => s.ok).length;
  let note = t("footer.refresh", { date: formatDate(rawEventsData.generatedAt) });
  if (statuses.length) {
    note += t("footer.sourcesLive", { ok: okCount, total: statuses.length });
  }
  lastUpdated.textContent = note;
} else {
  lastUpdated.textContent = t("footer.pending");
}
```

**Step 11: Verify syntax**

Run: `node --check app.js`
Expected: no output, exit 0.

**Step 12: Grep audit — no untranslated literals left in app.js render paths**

Run: `Select-String -Path app.js -Pattern '"All Events"','"Today"','"Date unknown"','more \$\{','via \$','Unconfirmed','events\}'`
Expected: no matches (all literals now live in i18n.js).

**Step 13: Commit**

```bash
git add app.js
git commit -m "feat: route dynamic UI through translations; Spanish-aware category search"
```

---

### Task 5: `style.css` — language toggle button

**Files:**
- Modify: `style.css` after line 227 (the `.theme-toggle-btn:hover` block)

**Step 1: Add the styles**

```css
/* Language Toggle (ES/EN) */
.lang-toggle-btn {
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  color: var(--text-main);
  min-width: 2.6rem;
  padding: 0.55rem 0.65rem;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-body);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  transition: all 0.2s ease;
}

.lang-toggle-btn:hover {
  border-color: var(--border-strong);
  color: var(--accent-primary);
}
```

**Step 2: Verify** — `node --check` does not apply to CSS; confirm the file still ends balanced (brace count even):

Run: `(Get-Content style.css | Select-String -Pattern '^}' ).Count -eq (Get-Content style.css | Select-String -Pattern '^\s*[^{}\n]*\{' ).Count` — approximate; simpler: view the last 20 lines to confirm no truncation, and Task 7's screenshots are the real check.

**Step 3: Commit**

```bash
git add style.css
git commit -m "style: ES/EN language toggle button"
```

---

### Task 6: `CLAUDE.md` — document the i18n conventions

**Files:**
- Modify: `CLAUDE.md` (Architecture section, `app.js` bullet)

**Step 1: Append to the app.js bullet**

Find the bullet beginning `- `app.js` handles client-side rendering...` and append after its final sentence ("...sorts Today Civic→Entertainment and This Week Live Music→Entertainment first (`SECTION_PRIORITY` in `app.js`)."):

```markdown
  A Spanish mode (ES/EN header toggle, auto-detected for Spanish-language
  browsers on first visit, choice persisted in localStorage
  `auroraevents.lang`) translates all UI chrome, category labels, dates, and
  empty states. All user-facing copy lives in `i18n.js` (`window.I18N`,
  loaded before `app.js`) — canonical English keys, es-MX-leaning Latin
  American Spanish values; static HTML carries `data-i18n` /
  `data-i18n-placeholder` / `data-i18n-aria` / `data-i18n-cat` attributes and
  dynamic renders call `t()` / `catLabel()` (`app.js`). Internal identifiers
  (bucket names, raw `event.category` values, form option values) stay
  canonical English; event titles/descriptions/venues are source-owned and
  never machine-translated; GitHub issue/PR payloads stay English.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe Spanish mode and i18n conventions in CLAUDE.md"
```

---

### Task 7: End-to-end verification

**Step 1: Serve the site**

Run in background: `npm run serve` (starts `http://localhost:8080`). Then:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8080 | Select-Object StatusCode
```

Expected: `200`. Confirm `i18n.js` serves too: `Invoke-WebRequest -UseBasicParsing http://localhost:8080/i18n.js | Select-Object StatusCode` → `200`.

**Step 2: English default (clean profile, English browser)**

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
& $edge --headless=new --disable-gpu --dump-dom "http://localhost:8080" 2>$null | Out-File -Encoding utf8 rendered-en.html
```

Assert in `rendered-en.html`:
- contains `lang="en"` (html attribute)
- contains `All Events` (tabs.all) and `>Today<` (bucket heading)
- contains `Propose a Source` and `FEATURED`
- contains `2+ date-group-heading` and does NOT contain `No events found` (dashboard rendered — English text proves `t()` fell back through the en dictionary correctly)
- contains `>ES<` (toggle shows the target language while in English)

**Step 3: Spanish auto-detect (clean profile, Spanish browser)**

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
& $edge --headless=new --disable-gpu --lang=es --user-data-dir="$env:TEMP\dsh-edge-es" --dump-dom "http://localhost:8080" 2>$null | Out-File -Encoding utf8 rendered-es.html
```

Assert in `rendered-es.html`:
- contains `lang="es"`
- contains `Todos los eventos`, `>Hoy<`, `Proponer una fuente`, `DESTACADO`, `Entretenimiento` (or another `category-badge` Spanish label from the current data — pick one actually present in the dump)
- does NOT contain `All Events` or `>Today<`
- contains `>EN<` (toggle flipped to show English as target)
- contains `Última actualización` (footer refresh line)
- `<title>` reads `Aurora Events — Calendario de eventos locales`

**Step 4: Persistence beats re-detection**

Re-run the SAME Spanish-profile command but with an English browser language — the stored `es` must win:

```powershell
& $edge --headless=new --disable-gpu --lang=en-US --user-data-dir="$env:TEMP\dsh-edge-es" --dump-dom "http://localhost:8080" 2>$null | Out-File -Encoding utf8 rendered-es-persist.html
```

Assert: still contains `Todos los eventos` / `lang="es"`, and NOT `All Events`. Then delete the temp profile: `Remove-Item -Recurse -Force "$env:TEMP\dsh-edge-es"`.

**Step 5: Visual screenshots**

```powershell
& $edge --headless=new --disable-gpu --screenshot="D:\Event_Calendar\verify-en.png" --window-size=1440,2600 "http://localhost:8080"
& $edge --headless=new --disable-gpu --lang=es --user-data-dir="$env:TEMP\dsh-edge-es2" --screenshot="D:\Event_Calendar\verify-es.png" --window-size=1440,2600 "http://localhost:8080"
& $edge --headless=new --disable-gpu --lang=es --user-data-dir="$env:TEMP\dsh-edge-es2" --screenshot="D:\Event_Calendar\verify-es-narrow.png" --window-size=390,2600 "http://localhost:8080"
```

(If a screenshot comes out in the wrong theme, retry with `--force-prefers-color-scheme=dark`.) Review the PNGs: header row with the new ES/EN button between "Propose a Source" and the theme toggle, no clipped text in Spanish (Spanish strings run ~15% longer — check the header/subtitle wrap and buttons at 390px), Spanish bucket headings/cards, footer translated, toggle visible. Clean up: `Remove-Item -Recurse -Force "$env:TEMP\dsh-edge-es2"` and delete the three PNGs.

**Step 6: Interaction code review (toggle click is not headlessly drivable)**

Re-read `initLanguage`/`applyLanguage`/`applyStaticI18n` (Task 2 Step 4) and confirm: click flips `activeLang`, persists, re-applies static copy, re-renders tabs + dashboard; `html lang`, `<title>`, meta description, toggle label/aria all sync; `t()` never returns empty (es→en→raw chain); `catLabel` falls back to raw. Manual click-through (both directions) on a real browser is the final human check.

**Step 7: Data integrity**

Run: `git status --short` — expected: no modifications to `data/events.json` or `scripts/`. Any unexpected change means a regression; revert it.

**Step 8: Final review & fix pass**

Re-read the final `i18n.js`, `applyStaticI18n`, and every Task 4 edit site against this plan; fix any discrepancy, re-run Steps 2-4, and commit fixes separately.

---

## Definition of done

- New `i18n.js` holds every user-facing string in `en` (byte-identical to today's copy) and `es` (es-MX-leaning Latin American), plus an `es.categories` map covering all observed categories; unknown categories fall back to raw English.
- First visit with a Spanish-language browser renders Spanish (`lang="es"`, Spanish `<title>`, translated header/panel/hero/footer/badges/buckets/empty states, es-MX dates); other browsers render English. The choice persists in `auroraevents.lang`; a later browser-language change does not override it.
- Header ES/EN toggle (styled, next to theme toggle) switches instantly in both directions, shows the target language, carries translated aria-label/title.
- Event titles/descriptions/venues and GitHub issue/PR payloads remain English; internal identifiers (buckets, raw categories, option values) unchanged — category filtering/tabs/search state and section priority all still work.
- Spanish search: typing "música" surfaces Live Music events; English search unchanged.
- English mode renders functionally and visually identical to the pre-change app (en dictionary mirrors existing copy; `en-US` date locale matches today's English-browser behavior).
- `data/events.json`, `scripts/`, and the pipeline are byte-identical (`git status` clean apart from the intended files).
- CLAUDE.md documents the i18n conventions.
