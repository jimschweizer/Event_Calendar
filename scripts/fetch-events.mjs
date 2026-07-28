import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeEvent, dedupeEvents } from "./lib/normalize.mjs";
import { fetchSource as fetchIcs } from "./adapters/ics.mjs";
import { fetchSource as fetchJsonLd } from "./adapters/jsonld.mjs";
import { fetchSource as fetchHtml } from "./adapters/html.mjs";
import { fetchSource as fetchRss } from "./adapters/rss.mjs";
import { fetchSource as fetchLegistar } from "./adapters/legistar.mjs";
import { fetchSource as fetchEventbrite } from "./adapters/eventbrite.mjs";
import { fetchSource as fetchTicketmaster } from "./adapters/ticketmaster.mjs";
import { fetchSource as fetchOcrImage } from "./adapters/ocr-image.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCES_PATH = path.join(__dirname, "..", "data", "sources.json");
const OUTPUT_PATH = path.join(__dirname, "..", "data", "events.json");

const ADAPTERS = {
  ics: fetchIcs,
  jsonld: fetchJsonLd,
  html: fetchHtml,
  rss: fetchRss,
  "api-legistar": fetchLegistar,
  "api-eventbrite": fetchEventbrite,
  "api-ticketmaster": fetchTicketmaster,
  "ocr-image": fetchOcrImage,
};

async function fetchAndNormalize(source) {
  const adapter = ADAPTERS[source.type];
  if (!adapter) {
    console.error(`[fetch-events] Unknown source type "${source.type}" for "${source.id}"`);
    return { id: source.id, ok: false, count: 0, error: `unknown source type: ${source.type}`, events: [] };
  }

  try {
    const { events: rawEvents, error } = await adapter(source);
    const events = rawEvents.map((raw) => normalizeEvent(raw, source));
    const skipped = typeof error === "string" && error.startsWith("skipped:");
    const ok = events.length > 0;
    if (error) {
      const level = skipped ? "[skip]" : "[warn]";
      console.error(`[fetch-events] ${level} "${source.id}": ${error}`);
    } else {
      console.log(`[fetch-events] "${source.id}": ${events.length} events`);
    }
    return { id: source.id, ok, count: events.length, error: error || null, events };
  } catch (err) {
    console.error(`[fetch-events] Failed to fetch source "${source.id}": ${err.message}`);
    return { id: source.id, ok: false, count: 0, error: err.message, events: [] };
  }
}

async function main() {
  const sources = JSON.parse(await readFile(SOURCES_PATH, "utf-8"));

  // Sequential: many distinct external domains, some bot-protected — sequential
  // keeps CI logs readable and is gentle on small independent/nonprofit sites.
  const results = [];
  for (const source of sources) {
    results.push(await fetchAndNormalize(source));
  }

  const allEvents = dedupeEvents(results.flatMap((r) => r.events)).sort((a, b) => {
    if (!a.start) return 1;
    if (!b.start) return -1;
    return a.start.localeCompare(b.start);
  });

  const sourceStatus = results.map(({ id, ok, count, error }) => ({ id, ok, count, error }));

  const output = {
    generatedAt: new Date().toISOString(),
    events: allEvents,
    sourceStatus,
  };

  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf-8");

  const okCount = sourceStatus.filter((s) => s.ok).length;
  const skippedCount = sourceStatus.filter((s) => s.error?.startsWith("skipped:")).length;
  const failedCount = sourceStatus.length - okCount - skippedCount;
  console.log(
    `[fetch-events] Wrote ${allEvents.length} events across ${sources.length} sources ` +
      `(${okCount} ok, ${skippedCount} skipped, ${failedCount} failed) to ${OUTPUT_PATH}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
