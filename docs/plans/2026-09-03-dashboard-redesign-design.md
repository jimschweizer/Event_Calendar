# Dashboard Redesign — Design Doc (2026-09-03)

Status: Approved by user (approach A, proposed design) on 2026-09-03.

## Problem

The fetch pipeline now ingests 563 events per snapshot; the single-page dashboard
renders every event in long date-bucketed lists (Today=54, This Week=63,
Later=351 as of the 2026-09-01 snapshot), so the page has become overrun and
unscannable. Priority events (Civic / Entertainment today, Live Music /
Entertainment this week) are buried under high-volume sources such as Shaw Local
"News Mentions" (42 on one day).

## Goals

1. Add a static **FEATURED** event at the top of the page (Quantum Prairie After
   Dark — Eventbrite listing, hardcoded).
2. Every event section shows at most **10 events**; remaining events collapse
   into a **drop-down menu** per section.
3. **Today**: events from **Civic**, then **Entertainment** categories first.
4. **This Week** (the "NEXT WEEK upcoming" area): events from **Live Music**,
   then **Entertainment** categories first.
5. Remain a static, no-backend app; do not touch the ingestion pipeline.

## Decisions (clarified with user)

| Question | Decision |
| --- | --- |
| "live-events" meaning | The **Live Music** category (The Venue, Two Brothers Roundhouse Eventbrite listings). |
| Section structure | Keep current buckets: Today / Tomorrow / This Week / Later / Unconfirmed Date (+ Proposed Sources block). |
| Overflow UI | First 10 as cards, then a styled **drop-down menu** of the remaining events (title + date/time rows, opens event link). |
| FEATURED visibility | **Always pinned** at top, in every view (loading, empty, category tab, search). |

## Approach chosen

**A — Pure frontend redesign** (no pipeline/cron/data changes):

- FEATURED card = static markup in `index.html` + hero styling in `style.css`.
- Section caps, drop-down menus, and priority ordering = client-side logic in
  `app.js` (rendering only; `data/events.json` untouched).

Rejected:
- **B — Data-layer approach** (priority/featured fields written by
  `fetch-events.mjs`): FEATURED event is not in any feed (Eventbrite key-gated),
  ordering rules are view preferences, refresh churn. No benefit.
- **C — Hybrid** (static hero + cron-generated order): stale between refreshes,
  same downsides as B.

## Page structure

```
<body>
  header (unchanged: brand, Propose a Source, theme toggle)
  sticky controls bar (unchanged: category tabs, search)
  <main>
    #status-message (unchanged, loading/error)
    #featured-section            ← NEW static FEATURED hero (always on top)
    #dashboard (grid)            ← JS-rendered bucket sections + Proposed Sources
  </main>
  footer (unchanged)
```

`#featured-section` lives outside `#dashboard` so `renderDashboard()` never
replaces it and it stays visible in every state.

## FEATURED hero (static)

- Title: **Quantum Prairie After Dark**
- Link: `https://www.eventbrite.com/e/quantum-prairie-after-dark-tickets-1998799157085?aff=oddtdtcreator`
  (target=_blank, rel=noopener noreferrer)
- Badges: `FEATURED` + `Entertainment`
- Honest copy — Eventbrite unreachable from dev machine, so no invented
  dates/images: after-dark nightlife at Quantum Prairie, the cocktail lounge
  inside Two Brothers Roundhouse, Aurora; "View listing on Eventbrite" CTA.
- Static block in `index.html`; content swap is a one-place edit.

## Section cap + drop-down

- Each date-bucket section renders its **first 10** events as cards.
- If more remain, render one full-width trigger per section:
  `＋ N more in {Section} ▾` (disclosure button).
- Trigger opens a **drop-down menu** (styled, absolutely positioned / in-flow
  panel) listing remaining events as compact rows:
  `title · formatted date/time · venue`. Rows are links (new tab). Menu is
  scrollable (max-height), closes on outside click / Escape, `aria-expanded`,
  keyboard accessible.
- Drop-down content = tail of the already-sorted section list (same order).
- Section headings gain a live count chip, e.g. `Today · 54`.
- Proposed Sources block unchanged (small, user-managed).

## Ordering rules

| Section | Order |
| --- | --- |
| Today | Civic → Entertainment → rest, start-time within each group |
| This Week | Live Music → Entertainment → rest, start-time within each group |
| Tomorrow / Later / Unconfirmed Date | start-time |

Rules apply in every view (All Events tab, category tabs, search). The first 10
visible + drop-down tail follow this sort.

Implementation: single `priorityIndex(event, sectionLabel)` helper returning a
sort key; `Array.prototype.sort` per section at render time.

## Visual direction

Fresh but contained refresh of the existing design system (dark/light CSS
variables, Inter/Outfit type, card grammar preserved) with a distinct FEATURED
hero treatment (gradient border/panel, editorial typography). No new
dependencies, no framework. Prior look & feel previews (preview-option-*.html)
are out of scope for this change.

## Files touched

- `index.html` — add `#featured-section` hero after `#status-message`.
- `style.css` — featured hero styles; section header count chips; drop-down
  trigger + menu styles; responsive rules.
- `app.js` — render section heading with count; sort per section with priority
  rules; cap 10; build drop-down trigger/menu with open/close/a11y behavior.
- `CLAUDE.md` or `README.md` — one paragraph describing new dashboard behavior.

## Verification

1. `node --check app.js` (syntax).
2. `npm run serve`; load `http://localhost:8080` with a headless browser
   screenshot (dark + light), confirm: FEATURED on top, Today/This Week first-10
   ordering (Civic→Entertainment / Live Music→Entertainment), drop-downs open
   with remaining events, Later section (300+) scrollable menu, search + tab
   interactions still render, no console errors.
3. Confirm `data/events.json` untouched (`git status`).

## Out of scope

- Pipeline/ingestion changes; Eventbrite/Ticketmaster API keys; live fetching
  of the FEATURED listing; deduplication of events; renaming buckets;
  adopting one of the preview-option look & feels.
