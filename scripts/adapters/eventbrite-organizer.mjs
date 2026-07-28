import * as cheerio from "cheerio";
import { USER_AGENT, FETCH_TIMEOUT_MS } from "../lib/normalize.mjs";

export async function fetchSource(source) {
  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const nextDataRaw = $("#__NEXT_DATA__").text().trim();
    if (!nextDataRaw) {
      return { events: [], error: "No __NEXT_DATA__ script tag found on organizer page" };
    }

    const nextData = JSON.parse(nextDataRaw);
    const rawEvents = nextData.props?.pageProps?.upcomingEvents ?? [];

    const events = rawEvents.map((item) => {
      const start = item.start_date && item.start_time 
        ? `${item.start_date}T${item.start_time}` 
        : item.start_date || null;
      const end = item.end_date && item.end_time 
        ? `${item.end_date}T${item.end_time}` 
        : item.end_date || null;

      return {
        title: item.name || "",
        description: item.summary || "",
        start,
        end,
        venue: item.primary_venue?.name || "",
        address: item.primary_venue?.address?.localized_address_display || "",
        link: item.url || source.url,
        imageUrl: item.image?.url || item.image?.image_sizes?.medium || null,
      };
    });

    if (events.length === 0) {
      return { events: [], error: "No upcoming events found on organizer profile" };
    }

    return { events, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
