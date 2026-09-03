# Spanish Mode — Design Doc (2026-09-03)

Status: Approved by user (content scope, auto-detect, es-MX dialect, approach A)
on 2026-09-03.

## Problem

Aurora's population is over 40% Hispanic, yet the calendar renders entirely in
English: static copy in `index.html`, dynamic UI strings in `app.js`, and
English-only `lang`/`title`/aria metadata. Spanish-speaking residents must read
English to use the app. The calendar needs Spanish available as an option.

## Goals

1. A **Spanish mode** covering all UI chrome, controls, badges, empty states,
   date formatting, and searchable category names — switched via a header
   toggle, exactly mirroring the existing theme-toggle pattern.
2. First-time visitors whose browser reports Spanish see Spanish
   automatically; everyone else sees English. Choice persists in localStorage.
3. Event content (titles, descriptions, venues) **stays as the source
   provides it** (English) — no machine translation, no privacy tradeoff.
4. Stay a static, no-backend, zero-build app; do not touch the ingestion
   pipeline or `data/events.json`.

## Decisions (clarified with user)

| Question | Decision |
| --- | --- |
| Event content in Spanish mode | Translate UI + categories only; event titles/descriptions/venues remain source English (they link to English source pages anyway). |
| Default language | Auto-detect browser language on first visit (Spanish browser → Spanish), then persist the choice; header toggle always available. |
| Which Spanish | es-MX-leaning Latin American copy (ustedes-form); Intl locale `es-MX` for dates/numbers. |
| Translation storage | A — dedicated `i18n.js` dictionary file (`window.I18N`, `en`/`es`) loaded before `app.js`; `data-i18n` attributes for static HTML, `t()` for dynamic strings. |

## Approach chosen

**A — Frontend-only i18n layer** (no pipeline/cron/data changes):

- New `i18n.js` holds `I18N = { en: {…}, es: {…} }` keyed by semantic strings;
  loaded synchronously before `app.js` — zero fetches, no flash of English.
- Static HTML elements carry `data-i18n` / `data-i18n-placeholder` /
  `data-i18n-aria` attributes; `applyStaticI18n()` re-labels them per language.
- `app.js` gains a tiny `t(key, vars?)` helper used by every dynamic render
  (bucket headings, chips, badges, overflow triggers, empty states, alerts).
- Language state mirrors the theme pattern: `auroraevents.lang` in
  localStorage (`"en"` | `"es"`), `<html lang>` attribute switched.

Rejected:
- **B — External JSON locale files fetched at runtime** (`locales/es.json`):
  async apply → initial English paint then swap, GitHub Pages cache-busting
  concerns, fetch-failure handling — all for ~80 strings.
- **C — Strings inline in `app.js`**: mixes copy into rendering code; makes
  translation PRs touch app logic; no benefit over A.

## Language state & switching

- `LANG_KEY = "auroraevents.lang"`, values `"en" | "es"`, stored on first
  decision (auto-detect or manual) so later browser-language changes never
  yank the UI.
- First visit with no stored value: `navigator.language` starts with `es` →
  Spanish, else English.
- Header gains a `lang-toggle` button next to the theme toggle showing the
  **target** language ("ES" in English, "EN" in Spanish) with full
  aria-label/title ("Cambiar a español" / "Switch to English").
- Applying a language: `document.documentElement.lang = "es"`, swap `<title>`
  and `<meta name="description">`, re-label toggle, `applyStaticI18n()`,
  re-render dashboard. Instant, no reload.
- Active Intl locale map `en → en-US`, `es → es-MX`; passed to every
  `Intl.DateTimeFormat` / `toLocaleDateString` call (`formatDate`,
  `formatEventDate`, `chicagoParts`) so weekday/month names and counts come
  out in Spanish — still anchored to America/Chicago wall clock.

## Translation plumbing

- **`i18n.js`** (new, loaded before `app.js` in `index.html`):
  `window.I18N = { en: {…}, es: {…} }`, semantic keys (e.g.
  `"bucket.today": "Today" / "Hoy"`). One clean file a bilingual contributor
  can PR without touching app logic.
- **`t(key, vars?)`**: current lang → fallback `en` → fallback raw key (never
  empty, never crashes). Supports `{var}` substitution and `one`/`other`
  plural objects (`t("events.count", {count: 54})` → "54 eventos").
- **Canonical English stays canonical**: bucket identifiers (`"Today"`,
  `"This Week"`…), `SECTION_PRIORITY` keys, raw `event.category` values,
  `<option>` *values*, and `dataset.category` never change — only their
  display is translated. Sorting, filtering, and category tab state keep
  working untouched.
- **Category display map** (`es`): every category observed in
  `data/events.json` (`Civic`, `Civic Meetings`, `Club / Social`, `Commerce`,
  `Education`, `Entertainment`, `Faith`, `Live Music`, `News Mentions`,
  `Parks & Rec`, `Retail`) plus form-only ones (`Community`, `General`).
  Unmapped categories fall back to the raw label — future categories can't
  break the UI.
- **Search in Spanish mode**: query matches raw English title/venue/source
  *plus* the raw and Spanish category (typing "música" surfaces Live Music
  events). Event titles stay English — a known, accepted boundary.
- **Grammar-safe phrasing**: bucket headings and overflow trigger avoid
  case/gender agreement traps (e.g. "Ver 6 eventos más" rather than
  "6 more Today events" rebuilt word-for-word).

## Translation scope — in

- Static HTML: `<title>` + meta description; header brand/subtitle incl. the
  refresh-time line ("Refreshed 6:00 AM & 5:30 PM CDT" → "Actualizado
  6:00 a. m. y 5:30 p. m. CDT") and BETA badge; "Propose a Source" button;
  full submit panel (headings, labels, placeholders, source-type option
  labels, category option labels, all four action buttons); search
  placeholder + clear aria; FEATURED hero (badge, category badge, title,
  description, venue line, Eventbrite CTA); footer blurb, sponsor line,
  GitHub/Data Sources links; aria-labels on icon-only buttons.
- Dynamic: date-bucket headings ("Today/Tomorrow/This Week/Later/Unconfirmed
  Date" → "Hoy/Mañana/Esta semana/Más adelante/Fecha sin confirmar") + count
  chips with one/other plurals; overflow trigger; confidence badges
  ("Unconfirmed — verify at source" → "Sin confirmar — verificar en la
  fuente"; "Community-sourced" → "Fuente comunitaria"); "via {source}" →
  "vía {source}"; queued-source card text and "✕ Remove" → "✕ Quitar";
  "Proposed Sources (pending review)" heading; empty state; "Last refresh:
  … · N/M sources live" footer line; "Background data pending."; all
  `alert()` strings in the submit flow; loading card; `<html lang>`, toggle
  aria-labels.

## Translation scope — out (deliberately)

- Event titles, descriptions, venue/address names — source-owned English.
- Raw data values: `event.category`, bucket identifiers, `<option>` values,
  `dataset.category` — canonical English internally.
- GitHub payloads (issue title/body, PR body, "Submitted via Aurora Events
  Dashboard 1-Click Action.") — English remains the single canonical format
  for maintainers; only surrounding UI copy and `alert()` confirmations
  translate.

## Error handling & fallbacks

- `t()` fail-safe chain: missing key in `es` → `en` → raw key (worst case
  English, never empty/crash).
- Unknown event categories → raw English label.
- Corrupt/absent localStorage value → auto-detect path; stored values
  validated against `["en", "es"]`.
- No async in the language path — nothing runtime-failable beyond a missing
  key, which is covered by the chain above.

## Testing & QA

- Manual pass in both languages over every surface in scope; grep audit for
  hardcoded English literals after the refactor (zero untranslated leaks).
- Toggle round-trip; reload persistence; first-visit auto-detect via DevTools
  `navigator.language` emulation (`es-MX`, `es-ES`, `en-US`, non-Spanish →
  English).
- `lang` attribute, `<title>`, aria-labels verified switched; screen-reader
  pass on the toggle.
- Spanish search: "música" finds Live Music events; English search unchanged.
- Regression: English mode visually/functionally identical to today; theme
  toggle unaffected; dates still America/Chicago wall clock in both
  languages.
- Spanish copy review by a native speaker — follow-up, not a gate.

## Docs

- `CLAUDE.md`: short i18n convention note — how to add a string, dialect
  rules (es-MX-leaning Latin American), never machine-translate event data,
  canonical keys stay English.
