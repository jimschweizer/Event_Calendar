import ical from "node-ical";
import { USER_AGENT, FETCH_TIMEOUT_MS } from "../lib/normalize.mjs";

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
        start: item.start ? new Date(item.start).toISOString() : null,
        end: item.end ? new Date(item.end).toISOString() : null,
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
