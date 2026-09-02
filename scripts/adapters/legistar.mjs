import { FETCH_TIMEOUT_MS, parseLooseDate } from "../lib/normalize.mjs";

const LOOKAHEAD_DAYS = 60;
const MAX_EVENTS = 25;

// Legistar's EventDate has no time component; EventTime is a separate "h:mm AM/PM" string.
// The combined value carries no zone → parseLooseDate interprets it as
// America/Chicago wall time (deterministic on the UTC cron runner).
function combineDateTime(eventDate, eventTime) {
  if (!eventDate) return null;
  const datePart = eventDate.slice(0, 10);
  if (!eventTime) return parseLooseDate(`${datePart}T00:00:00`);
  const match = eventTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return parseLooseDate(`${datePart}T00:00:00`);
  let [, hh, mm, ap] = match;
  let hour = Number(hh) % 12;
  if (ap.toUpperCase() === "PM") hour += 12;
  return parseLooseDate(`${datePart}T${String(hour).padStart(2, "0")}:${mm}:00`);
}

export async function fetchSource(source) {
  const today = new Date().toISOString().slice(0, 10);
  const params = new URLSearchParams({
    "$filter": `EventDate ge datetime'${today}'`,
    "$orderby": "EventDate asc",
    "$top": String(MAX_EVENTS),
  });
  const url = `${source.url}?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const cutoff = Date.now() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;
    const events = (Array.isArray(data) ? data : [])
      .map((item) => {
        const start = combineDateTime(item.EventDate, item.EventTime);
        return {
          title: item.EventBodyName ? `${item.EventBodyName} Meeting` : "Aurora City Meeting",
          description: item.EventComment || "",
          start,
          venue: item.EventLocation || "Aurora City Hall",
          link: item.EventInSiteURL || source.url,
        };
      })
      .filter((e) => e.start && new Date(e.start).getTime() <= cutoff);

    if (events.length === 0) {
      return { events: [], error: "no upcoming meetings within the lookahead window" };
    }
    return { events, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
