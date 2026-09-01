# Aurora Events — Local Events Calendar, Aurora, IL

**Live Website:** [https://jimschweizer.github.io/Event_Calendar/](https://jimschweizer.github.io/Event_Calendar/)  
**GitHub Repository:** [https://github.com/jimschweizer/Event_Calendar](https://github.com/jimschweizer/Event_Calendar)

A privacy-first, serverless local events calendar for Aurora, IL. A GitHub Actions workflow runs
a hybrid ingestion pipeline twice daily (at **6:00 AM CDT** and **5:00 PM CDT**), pulling from
~25 real Aurora-area sources — civic, schools, parks, theaters, retail, churches, and independent
venues — and commits the merged, structured result as `data/events.json`.

The dashboard runs completely client-side (`index.html` / `style.css` / `app.js`) with zero
backend server or API keys required to run it (two optional ticketing APIs add extra coverage
if you configure them — see [Optional API Keys](#optional-api-keys)).

## Key Features

- **Modern Dark & Light UI**: Glassmorphic design, custom typography (Outfit & Inter), responsive
  card grid, persistent theme switcher.
- **Hybrid Ingestion Pipeline**: ICS/iCal feeds, Schema.org JSON-LD scraping, generic HTML
  scraping, RSS/Atom, the Legistar civic-meetings API, Eventbrite/Ticketmaster (optional), and
  best-effort OCR for image-only flyers — each source in `data/sources.json` declares which.
- **Date-Grouped Calendar View**: Events bucketed into Today / Tomorrow / This Week / Later.
- **Category Tabs & Live Search**: Instant client-side filtering across title, venue, source, category.
- **Transparent Source Health**: `data/events.json` includes a `sourceStatus` array showing which
  of the ~25 sources returned real data, were skipped (no API key), or failed — surfaced in the
  footer as "N/M sources live" rather than silently hidden.
- **1-Click GitHub Source Proposing**: Click **Propose a Source** to open a pre-filled GitHub
  Issue or 1-click PR to add a new feed to `data/sources.json`.

## Architecture

```
data/sources.json  →  scripts/fetch-events.mjs  →  data/events.json  →  app.js renders it
                          │
                          ├─ adapters/ics.mjs          node-ical, direct .ics/.ical feeds
                          ├─ adapters/jsonld.mjs        Schema.org/Event JSON-LD (listing + linked detail pages)
                          ├─ adapters/html.mjs          generic cheerio scraper, per-source CSS selectors
                          ├─ adapters/rss.mjs           rss-parser, for sources with a real RSS/Atom feed
                          ├─ adapters/legistar.mjs      Legistar Web API (Aurora city council, public, no key)
                          ├─ adapters/eventbrite.mjs    Eventbrite Discovery API (needs EVENTBRITE_TOKEN)
                          ├─ adapters/ticketmaster.mjs  Ticketmaster Discovery API (needs TICKETMASTER_KEY)
                          └─ adapters/ocr-image.mjs     tesseract.js OCR on flyer images (isolated subprocess,
                                                          confidence: "low", always "verify at source")
```

Each source in `data/sources.json` has a `type` that selects its adapter. The orchestrator
(`scripts/fetch-events.mjs`) fetches sources **sequentially** (readable CI logs, gentle on small
independent sites), wraps each in try/catch so one broken source never sinks the run, normalizes
every result through `scripts/lib/normalize.mjs` (stable id hashing, dedup), sorts by start date,
and writes `data/events.json` with a per-source `sourceStatus` entry.

`data/sources.json`'s catalog was seeded from a research pass over Aurora's civic, commercial, and
community sites (municipal calendars, park district, schools, theaters, malls, churches, and
independent venues). Sites vary wildly in tech stack — some expose clean ICS or JSON-LD, others
are plain static HTML, a few run behind bot-detection (Cloudflare) that blocks a plain server-side
`fetch()`, and one (The Phoenix Club) posts events as Wix image flyers with no text markup at all.
`sourceStatus` in `data/events.json` is the honest, current picture of which sources are actually
returning data — many `html`-typed sources need their `selectors` tuned against the live DOM
before they'll match anything, which is expected and by design (see below).

### Confidence levels

Every event carries a `confidence`:
- **high** — ICS, Legistar, Eventbrite, Ticketmaster (structured APIs/feeds)
- **medium** — JSON-LD, generic HTML scraping, RSS mentions
- **low** — OCR-derived from a flyer image; always shown with an "Unconfirmed — verify at source" badge

## Local Development

```bash
npm install
npm run fetch-events   # runs scripts/fetch-events.mjs, regenerates data/events.json
npm run serve          # serves the dashboard at http://localhost:8080
```

> **Note**: Open via `http://localhost:8080` (or `npm run serve`), as browsers block
> `fetch("data/events.json")` over `file://`.

## Improving Source Coverage

Many `html`-typed sources in `data/sources.json` ship with generic default selectors and will
report 0 events until tuned. To fix one:

1. Run `npm run fetch-events` and check the console output / `data/events.json`'s `sourceStatus`
   for sources reporting an error.
2. Inspect the live page's DOM and add a `selectors` block to that source in `data/sources.json`
   (`item`, `title`, `date`, `link` — all CSS selectors, `date` should resolve to something with a
   `datetime` attribute or parseable date text).
3. Re-run and confirm real events appear with sane titles/dates.

Notes from the tuning pass:

- Where a source's own widget is backed by a public JSON API (ChamberMaster/GrowthZone chamber
  calendars, Communico library calendars, CitySpark community-event portals), prefer the
  `api-json` adapter over scraping the JS-rendered page — see the `apiJson` configs in
  `data/sources.json`.
- A few sources remain at 0 by design and show it honestly in `sourceStatus`:
  - `hollywood-casino` — pennentertainment.com sits behind a Cloudflare JS challenge (HTTP 403).
  - `chicago-premium-outlets` — Simon's content API returns no current events for the mall.
  - `st-marks-lutheran` — the CloverSites calendar app renders client-side and its API requires
    authorization.
  - `phoenix-club` — Wix image flyers OCR'd locally (`spawn EPERM` appears only in sandboxed
    runs; it works in GitHub Actions).

## Optional API Keys

Two sources are key-gated and skip gracefully (not a failure) if unset:

- `EVENTBRITE_TOKEN` — Eventbrite personal token. Note: Eventbrite restricted public search access
  to select partner apps around 2019, so this may return 401/403 for a standard token.
- `TICKETMASTER_KEY` — free self-serve key from the [Ticketmaster Developer portal](https://developer-acct.ticketmaster.com/).

Add them as repository secrets (**Settings → Secrets and variables → Actions**) to enable.

## Proposing Sources from the Dashboard

Click **Propose a Source** in the header. You can:
1. **Submit Issue on GitHub**: Opens a pre-filled GitHub Issue with the JSON snippet.
2. **1-Click PR (Edit sources.json)**: Copies the JSON snippet and opens GitHub's web file editor.
3. **Save in Browser Only**: Queues the source locally in `localStorage` for testing.
4. **Copy JSON Snippet**: Copies formatted JSON payload.

## Making Your Calendar AI-Crawler Friendly

If you are a local Aurora organization (business, school district, library, church, or civic group) looking to have your events seamlessly ingested by community aggregators, check out our [AI-Crawler & Aggregator Compatibility Guide](GEMINI.md). It outlines best practices such as exposing public iCal/ICS feeds, utilizing Schema.org JSON-LD markup, and avoiding image-only event flyer anti-patterns.

## Deployment

1. Fork/push this repository to GitHub.
2. Go to **Settings → Pages** and choose **Deploy from branch** (`main` / root).
3. `.github/workflows/fetch-events.yml` runs twice daily at **6:00 AM CDT** (`0 11 * * *`) and
   **5:00 PM CDT** (`0 22 * * *`) to automatically commit fresh data to GitHub Pages.

## License

This project is open-source and released under the [MIT License](LICENSE).

