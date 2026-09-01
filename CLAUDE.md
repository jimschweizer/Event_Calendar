# CLAUDE.md

This file provides guidance for AI coding assistants working in this repository.

## What this is

A browser-based, open-source local events calendar for Aurora, IL, with no backend server. A
GitHub Actions cron job runs a hybrid ingestion pipeline twice daily (at 6:00 AM CDT and 5:30 PM
CDT), fetches events from ~25 real Aurora-area sources, and commits the merged result as static
JSON (`data/events.json`); the frontend (`index.html`, `style.css`, `app.js`) reads that JSON.

This app was pivoted from an earlier "news dashboard" incarnation (single RSS/Google-News topic
model) to a structured events calendar with a multi-adapter ingestion pipeline. `RESEARCH.md`
documents the source catalog research behind `data/sources.json` — treat its specific event
listings as illustrative, not verified data; only its source URLs/tech-stack notes were used.

## Commands

```bash
npm install
npm run fetch-events   # runs scripts/fetch-events.mjs, regenerates data/events.json
npm run serve          # static file server at http://localhost:8080 (scripts/serve.mjs)
```

`index.html` must be loaded via `npm run serve` (or any static server) — not `file://` — because
`app.js` fetches `data/events.json`, which browsers block under the file protocol.

## Architecture

There is exactly one source of real event data: `data/sources.json` → `data/events.json`.

- `scripts/fetch-events.mjs` is the orchestrator: for each source in `data/sources.json`, it
  dispatches to the adapter matching `source.type`, normalizes the result via
  `scripts/lib/normalize.mjs`, sorts everything by start date, and writes `data/events.json` with
  a `sourceStatus` array (per-source ok/count/error — never silently hidden).
- Adapters live in `scripts/adapters/`, one per source `type`: `ics` (node-ical), `jsonld`
  (Schema.org/Event via cheerio; falls back to Next.js `__NEXT_DATA__` payloads, then WordPress
  "Ajax Load More" `post__in` ids fetched via `?p={id}`, then generic listing-page detail links;
  optional per-source `venueFilter` keeps only events whose venue name matches; sends browser-like
  headers because e.g. paramountaurora.com's WAF 403s bare requests), `html` (generic cheerio
  scraper driven by per-source `selectors`), `api-json` (generic JSON-events-API adapter driven by
  per-source `apiJson` config — for sources whose widgets are backed by a clean JSON API, e.g.
  ChamberMaster/GrowthZone, Communico library calendars, CitySpark portals; supports GET/POST,
  dot-path field mapping, and `{{today}}`/`{{today+N}}` date tokens), `rss` (rss-parser),
  `api-legistar` (Aurora city council, public API, no key), `api-eventbrite`/`api-ticketmaster`
  (key-gated — skip gracefully, not a failure, if `EVENTBRITE_TOKEN`/`TICKETMASTER_KEY` env vars
  are unset), and `ocr-image` (tesseract.js, for The Phoenix Club's Wix image-only flyers).
- `ocr-image.mjs` spawns `ocr-image-worker.mjs` as a **child process**, not an in-process call —
  tesseract.js has a known failure mode (certain malformed/unsupported images) that throws
  asynchronously past any try/catch and kills the Node process outright. Isolating it means that
  crash only takes down the worker, not the twice-daily cron run. Don't collapse this back into a
  direct import without re-solving that problem.
- `.github/workflows/fetch-events.yml` runs on cron (`0 11 * * *` and `30 22 * * *`) and commits
  `data/events.json` directly to `main`. (A previous version of this workflow lived at
  `github/workflows/` — missing the leading dot — and was silently never picked up by GitHub
  Actions. If you ever see a non-dot `github/` directory reappear, that's the same bug.)
- `app.js` handles client-side rendering: date-bucketed sections (Today/Tomorrow/This
  Week/Later/Unconfirmed Date), category tabs, live search, confidence badges (`low`/`medium`
  events are visibly marked "verify at source"), and the "Propose a Source" GitHub Issue/PR flow
  targeting `data/sources.json`.

## Key Constraints & Gotchas

- Confidence levels are assigned by adapter type in `normalize.mjs`: `high` (ics, legistar,
  eventbrite, ticketmaster), `medium` (jsonld, html, rss), `low` (ocr-image, always). Don't
  upgrade an adapter's confidence without a real reason — the UI relies on it to warn users off
  unverified data.
- The generic `html` adapter deliberately requires a parseable date on every matched item (bare
  `li` selectors alone matched nav/social-menu junk in testing — 285 "events" that were Facebook/
  LinkedIn links). It also dedupes matched elements by detail-page link (or `title|start`) because
  loose class selectors like `[class*='event']` commonly match several nested wrapper/badge/title
  elements around one real event. If you're tuning selectors for a new source and getting zero or
  garbage results, check both of these behaviors before assuming the selector itself is wrong.
- `fetch-events.mjs` fetches sources sequentially — same reasoning as the old news fetcher (gentle
  on small/nonprofit sites, readable CI logs), now more important with ~25 distinct external
  domains involved.
- Several sources in `data/sources.json` are known to sit behind bot-detection (Cloudflare) or be
  JS-rendered, so plain server-side `fetch()` won't see real content — these show up honestly in
  `sourceStatus` as 0 events rather than being faked. This is expected, not a bug to silently work
  around with a headless browser unless you deliberately decide to take on that dependency.
- The 1-click source submission uses GitHub web URLs (`/issues/new` and `/edit/main/data/sources.json`),
  avoiding client-side GitHub token requirements — same pattern as the original topic-submission flow.
