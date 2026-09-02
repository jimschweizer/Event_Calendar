import Parser from "rss-parser";

const parser = new Parser({ timeout: 15000 });
const ITEMS_PER_SOURCE = 20;

// Some local feeds (e.g. Enjoy Aurora) are *digests*: items are pre-published
// with a future "featured on" pubDate at 23:59:59, while the item description
// opens with the real event window ("09/02/2026 to 09/02/2026 - ..." or
// "Starting 08/26/2026 - ..."). Treat pubDate (a newsletter timestamp, not an
// event time) as a last resort only.
const MM_DD_YYYY = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/;

// Returns an America/Chicago date-only start ("2026-09-02") when the
// description carries a US-format event date, else null.
function eventDateFromDescription(description) {
  const m = description?.match(MM_DD_YYYY);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export async function fetchSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const items = (feed.items ?? []).slice(0, ITEMS_PER_SOURCE).map((item) => {
      const description = item.contentSnippet || "";
      const eventDate = eventDateFromDescription(description);
      return {
        title: item.title?.trim() ?? "(untitled)",
        description,
        // Date-only → interpreted as Chicago midnight; no fake "11:59 PM".
        start: eventDate || (item.pubDate ?? item.isoDate ?? null),
        allDay: !!eventDate,
        link: item.link ?? source.url,
      };
    });

    if (items.length === 0) {
      return { events: [], error: "feed returned 0 items" };
    }
    return { events: items, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
