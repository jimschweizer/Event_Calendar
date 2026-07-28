import crypto from "node:crypto";

export const USER_AGENT = "Mozilla/5.0 (compatible; AuroraEventsBot/0.1; +https://github.com/)";
export const FETCH_TIMEOUT_MS = 15000;

const CONFIDENCE_BY_TYPE = {
  ics: "high",
  "api-legistar": "high",
  "api-eventbrite": "high",
  "api-ticketmaster": "high",
  rss: "medium",
  jsonld: "medium",
  html: "medium",
  "ocr-image": "low",
};

export function stableId(parts) {
  const key = parts
    .filter(Boolean)
    .map((p) => String(p).toLowerCase().trim())
    .join("|");
  return crypto.createHash("sha1").update(key).digest("hex").slice(0, 16);
}

export function parseLooseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Normalizes one adapter-shaped raw event into the final event.json shape.
export function normalizeEvent(raw, source) {
  const title = (raw.title || "").trim() || "(untitled event)";
  const start = parseLooseDate(raw.start);
  const end = parseLooseDate(raw.end);
  const venue = raw.venue || source.venue || "";
  const id = stableId([title, venue, start || raw.start || ""]);

  return {
    id,
    title,
    description: (raw.description || "").trim(),
    start,
    end,
    allDay: !!raw.allDay,
    venue,
    address: raw.address || source.address || "",
    category: source.category || "General",
    sourceId: source.id,
    sourceLabel: source.label,
    link: raw.link || source.url,
    imageUrl: raw.imageUrl || null,
    confidence: raw.confidence || CONFIDENCE_BY_TYPE[source.type] || "medium",
    tags: raw.tags || [],
  };
}

// De-dupes by stable id, keeping the first occurrence.
export function dedupeEvents(events) {
  const seen = new Map();
  for (const event of events) {
    if (!seen.has(event.id)) seen.set(event.id, event);
  }
  return Array.from(seen.values());
}
