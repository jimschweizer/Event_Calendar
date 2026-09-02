import ical from "node-ical";
import { USER_AGENT, FETCH_TIMEOUT_MS, parseLooseDate } from "../lib/normalize.mjs";

function pad2(n) {
  return String(n).padStart(2, "0");
}

// node-ical parses VALUE=DATE entries as *midnight in the runner's local
// timezone* — on the UTC cron that lands one calendar day early for Chicago
// viewers. Re-anchor date-only entries to America/Chicago midnight instead.
// (Extracting the calendar date from node-ical's local-midnight Date is safe
// in any runner timezone.)
function dateOnlyToIso(dateLike) {
  if (!dateLike) return null;
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return null;
  const wall = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T00:00:00`;
  return parseLooseDate(wall);
}

function startToIso(item) {
  if (item.datetype === "date") return dateOnlyToIso(item.start);
  return item.start ? new Date(item.start).toISOString() : null;
}

export async function fetchSource(source) {
  try {
    // Fetch manually (consistent UA/timeout with the other adapters) and parse
    // the text ourselves, so an empty-but-valid feed (HTTP 200, 0 VEVENTs) is
    // distinguishable from a broken/missing feed in the error message.
    const res = await fetch(source.url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const data = ical.parseICS(text);

    const events = [];
    for (const key of Object.keys(data)) {
      const item = data[key];
      if (item.type !== "VEVENT") continue;
      events.push({
        title: item.summary || "",
        description: item.description || "",
        start: startToIso(item),
        end: item.datetype === "date" ? dateOnlyToIso(item.end) : item.end ? new Date(item.end).toISOString() : null,
        allDay: item.datetype === "date",
        venue: item.location || "",
        link: item.url || source.url,
      });
    }
    if (events.length === 0) {
      return {
        events: [],
        error: `no VEVENT entries found in feed (${text.length} bytes, ${Object.keys(data).length} components) — calendar may be empty, or calendar_ids may point at a nonexistent calendar`,
      };
    }
    return { events, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
