import crypto from "node:crypto";

export const USER_AGENT = "Mozilla/5.0 (compatible; AuroraEventsBot/0.1; +https://github.com/)";
export const FETCH_TIMEOUT_MS = 15000;

// Every source on this calendar is an Aurora / Fox Valley (IL) venue, so a
// date-time that carries no explicit UTC offset is a wall-clock time in
// America/Chicago — NOT the timezone of whatever machine happens to run the
// fetch. Parsing naive strings with the process-local zone made the output
// depend on the runner: the GitHub Actions cron (UTC) produced every naive
// time ~5h early for Chicago viewers, while a dev run in Chicago happened to
// look right. All naive/zone-less parsing below is anchored to Chicago.
const EVENT_TIME_ZONE = "America/Chicago";

// Chicago's UTC offset (minutes west, e.g. -300 in CDT / -360 in CST) at a
// given UTC instant. Requires full-icu Intl (Node 16+, all modern browsers).
function chicagoOffsetMinutes(utcMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    timeZoneName: "longOffset",
  }).formatToParts(new Date(utcMs));
  const tzPart = parts.find((p) => p.type === "timeZoneName")?.value || "";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(tzPart);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// The wall-clock components (local time in America/Chicago) of a UTC instant.
function chicagoWallParts(utcMs) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

// Interprets an ISO-style wall-clock value ("2026-09-01 11:00:00",
// "2026-09-01T11:00:00", or a date-only "2026-09-01") as America/Chicago time
// and returns the equivalent UTC ISO instant (or null if unparseable).
export function chicagoWallToISOString(value) {
  if (value == null) return null;
  const s = String(value).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (!m) m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return null;
  const wall = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[4] === undefined ? 0 : Number(m[4]),
    minute: m[4] === undefined ? 0 : Number(m[5]),
    second: m[4] === undefined ? 0 : Number(m[6] || 0),
  };
  // Guess the instant by reading the wall clock as UTC, then correct once for
  // DST edges: wall time = UTC + offset, so instant = wall − offset.
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  if (Number.isNaN(guess)) return null;
  let instant = guess - chicagoOffsetMinutes(guess) * 60000;
  for (let i = 0; i < 2; i++) {
    const got = chicagoWallParts(instant);
    if (
      got.year === wall.year &&
      got.month === wall.month &&
      got.day === wall.day &&
      got.hour === wall.hour &&
      got.minute === wall.minute &&
      got.second === wall.second
    ) {
      break;
    }
    instant = guess - chicagoOffsetMinutes(instant) * 60000;
  }
  return new Date(instant).toISOString();
}

// UTC instant of today's midnight in America/Chicago — the same "before
// today" boundary app.js's bucketFor() uses to drop past events from view.
// fetch-events.mjs uses this as its cutoff so events.json doesn't ship
// already-expired events the frontend immediately discards.
export function chicagoTodayStartISOString() {
  const { year, month, day } = chicagoWallParts(Date.now());
  return chicagoWallToISOString(`${year}-${pad2(month)}-${pad2(day)}T00:00:00`);
}

// True when the string itself declares a zone (trailing Z or ±hh:mm offset).
const DECLARES_ZONE = /(?:Z|[+-]\d{2}:?\d{2})\s*$/i;
// RFC-822 style zone abbreviations V8 understands (GMT/UTC/US zones). These
// carry real zone semantics, so they must parse as instants, not wall time.
const ZONE_ABBR = /\b(?:GMT|UTC|[ECMP][SD]T|EST|CST|MST|PST|AKST|AKDT|HST|HAST|HADT)\b\s*$/i;
// Purely numeric values are epoch millis — always instants, never wall time.
const NUMERIC_ONLY = /^\d+$/;

export function parseLooseDate(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const s = String(value).trim();
  if (!s) return null;
  if (NUMERIC_ONLY.test(s)) {
    const d = new Date(Number(s));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  // Explicit numeric zone (e.g. "…T19:30:00-05:00", "…T19:30:00Z",
  // RFC-822 "…-0500") or a zone abbreviation: a true instant.
  if (DECLARES_ZONE.test(s) || ZONE_ABBR.test(s)) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  // No zone at all → a wall clock in Aurora, IL (America/Chicago).
  const wall = chicagoWallToISOString(s);
  if (wall) return wall;
  // Lenient wall forms ("September 12, 2026 7:30 PM", "9/12/2026 19:30").
  // V8 parses these as runner-local time, but reading back the *local*
  // components yields exactly the wall clock that was written, in any runner
  // timezone — so rebuild those components as Chicago wall time.
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    const rebuilt = chicagoWallToISOString(
      `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
        `T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
    );
    if (rebuilt) return rebuilt;
  }
  return null;
}

const CONFIDENCE_BY_TYPE = {
  ics: "high",
  "api-legistar": "high",
  "api-eventbrite": "high",
  "api-ticketmaster": "high",
  "eventbrite-organizer": "high",
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

// Normalizes one adapter-shaped raw event into the final event.json shape.
export function normalizeEvent(raw, source) {
  const title = (raw.title || "").trim() || "(untitled event)";
  const start = parseLooseDate(raw.start);
  const end = parseLooseDate(raw.end);
  const venue = raw.venue || source.venue || "";
  const id = stableId([title, venue, start || raw.start || ""]);

  // Date-only listings (start exactly on America/Chicago midnight and no
  // meaningful end) carry no real time-of-day — show them as all-day rather
  // than a fabricated "12:00 AM". Real timed events start at other hours or
  // carry an end time.
  let allDay = !!raw.allDay;
  if (!allDay && start && (!end || end === start) && isChicagoMidnight(start)) {
    allDay = true;
  }

  return {
    id,
    title,
    description: (raw.description || "").trim(),
    start,
    end,
    allDay,
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

// True when the instant lands exactly on midnight in America/Chicago.
function isChicagoMidnight(iso) {
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return false;
  const p = chicagoWallParts(ms);
  return p.hour === 0 && p.minute === 0 && p.second === 0;
}

// De-dupes by stable id, keeping the first occurrence.
export function dedupeEvents(events) {
  const seen = new Map();
  for (const event of events) {
    if (!seen.has(event.id)) seen.set(event.id, event);
  }
  return Array.from(seen.values());
}

// Keeps only the first event instance of a specific show at a specific venue per calendar week.
export function dedupeWeeklyRuns(events) {
  const seen = new Set();
  
  return events.filter((event) => {
    if (!event.start || !event.venue || !event.title) return true;

    // 1. Normalize title (lowercase, alphanumeric only, slice first 30 chars)
    const cleanTitle = event.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 30);

    // 2. Normalize venue
    const cleanVenue = event.venue.toLowerCase().replace(/[^a-z0-9]/g, "");

    // 3. Find the Sunday of the event's week (to act as the week identifier)
    const date = new Date(event.start);
    const day = date.getDay();
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - day);
    const weekKey = sunday.toISOString().slice(0, 10); // YYYY-MM-DD

    // 4. Create a unique composite key for this show run
    const key = `${cleanTitle}|${cleanVenue}|${weekKey}`;

    if (seen.has(key)) {
      return false; // Filter out subsequent showtimes in the same week
    }
    
    seen.add(key);
    return true;
  });
}

// For multi-show theatrical runs that span multiple weeks/months, limit listings to those starting within the next 30 days.
export function filterMultiShowRuns(events) {
  const maxFutureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  
  // 1. Group events to count occurrences of cleanTitle + cleanVenue
  const groups = new Map();
  for (const event of events) {
    if (!event.start || !event.venue || !event.title) continue;
    const cleanTitle = event.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 30);
    const cleanVenue = event.venue.toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = `${cleanTitle}|${cleanVenue}`;
    
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(event);
  }

  // 2. Filter events where group length is > 1 and start date is > 30 days in the future
  return events.filter((event) => {
    if (!event.start || !event.venue || !event.title) return true;
    const cleanTitle = event.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 30);
    const cleanVenue = event.venue.toLowerCase().replace(/[^a-z0-9]/g, "");
    const key = `${cleanTitle}|${cleanVenue}`;
    
    const group = groups.get(key);
    if (group && group.length > 1) {
      return event.start <= maxFutureDate;
    }
    
    return true;
  });
}


