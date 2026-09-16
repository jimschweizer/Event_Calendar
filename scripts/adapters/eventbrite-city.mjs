import * as cheerio from "cheerio";
import { FETCH_TIMEOUT_MS } from "../lib/normalize.mjs";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "sec-ch-ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((e) => {
    const key = `${e.link || ""}|${e.title || ""}|${e.start || ""}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseServerDataEvents(html) {
  const serverDataMatch = html.match(/window\.__SERVER_DATA__\s*=\s*({.*?});/s);
  if (!serverDataMatch) return null;
  try {
    const sd = JSON.parse(serverDataMatch[1]);
    const rawEvents = sd.search_data?.events?.results ?? [];
    return rawEvents.map((item) => {
      const start =
        item.start_date && item.start_time
          ? `${item.start_date}T${item.start_time}`
          : item.start_date || null;
      const end =
        item.end_date && item.end_time
          ? `${item.end_date}T${item.end_time}`
          : item.end_date || null;

      const addr = item.primary_venue?.address;
      const addressDisplay =
        addr?.localized_address_display ||
        [addr?.address_1, addr?.city, addr?.region, addr?.postal_code]
          .filter(Boolean)
          .join(", ") ||
        "";

      return {
        title: item.name || "",
        description: item.summary || "",
        start,
        end,
        venue: item.primary_venue?.name || "",
        address: addressDisplay,
        city: addr?.city || "",
        link: item.url || "",
        imageUrl: item.image?.url || item.image?.image_sizes?.medium || null,
      };
    });
  } catch {
    return null;
  }
}

function parseJsonLdEvents(html) {
  const $ = cheerio.load(html);
  const events = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      if (data["@type"] === "ItemList" && Array.isArray(data.itemListElement)) {
        for (const elem of data.itemListElement) {
          const item = elem.item;
          if (!item || (item["@type"] !== "Event" && item["@type"] !== "BusinessEvent")) continue;

          const loc = Array.isArray(item.location) ? item.location[0] : item.location;
          const addr = loc?.address;
          const addressText =
            typeof addr === "string"
              ? addr
              : [addr?.streetAddress, addr?.addressLocality, addr?.addressRegion, addr?.postalCode]
                  .filter(Boolean)
                  .join(", ");
          const image = Array.isArray(item.image) ? item.image[0] : item.image?.url || item.image;

          events.push({
            title: item.name || "",
            description: typeof item.description === "string" ? item.description : "",
            start: item.startDate || null,
            end: item.endDate || null,
            venue: loc?.name || "",
            address: addressText || "",
            city: addr?.addressLocality || "",
            link: item.url || "",
            imageUrl: typeof image === "string" ? image : null,
          });
        }
      }
    } catch {
      // ignore JSON parse error on malformed blocks
    }
  });

  return events;
}

export async function fetchSource(source) {
  const maxPages = Number(source.maxPages) || 3;
  const cityFilter = source.cityFilter ? String(source.cityFilter).trim().toLowerCase() : null;
  const baseUrl = new URL(source.url);

  const collectedEvents = [];
  let lastError = null;

  for (let page = 1; page <= maxPages; page++) {
    const pageUrl = new URL(baseUrl.toString());
    pageUrl.searchParams.set("page", String(page));

    try {
      const res = await fetch(pageUrl.toString(), {
        headers: BROWSER_HEADERS,
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        break;
      }

      const html = await res.text();

      let pageEvents = parseServerDataEvents(html);
      if (!pageEvents || pageEvents.length === 0) {
        pageEvents = parseJsonLdEvents(html);
      }

      if (!pageEvents || pageEvents.length === 0) {
        // No more events on this page or future pages
        break;
      }

      for (const ev of pageEvents) {
        if (cityFilter) {
          const cityMatches =
            ev.city.toLowerCase().includes(cityFilter) ||
            ev.address.toLowerCase().includes(cityFilter) ||
            ev.venue.toLowerCase().includes(cityFilter);
          if (!cityMatches) continue;
        }
        collectedEvents.push(ev);
      }

      if (page < maxPages) {
        await sleep(250);
      }
    } catch (err) {
      lastError = err.message;
      break;
    }
  }

  const uniqueEvents = dedupeEvents(collectedEvents);

  if (uniqueEvents.length === 0) {
    return {
      events: [],
      error: lastError || "no events found matching criteria",
    };
  }

  return { events: uniqueEvents, error: null };
}
