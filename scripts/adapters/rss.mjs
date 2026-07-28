import Parser from "rss-parser";

const parser = new Parser({ timeout: 15000 });
const ITEMS_PER_SOURCE = 20;

export async function fetchSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const items = (feed.items ?? []).slice(0, ITEMS_PER_SOURCE).map((item) => ({
      title: item.title?.trim() ?? "(untitled)",
      description: item.contentSnippet || "",
      start: item.pubDate ?? item.isoDate ?? null,
      link: item.link ?? source.url,
    }));

    if (items.length === 0) {
      return { events: [], error: "feed returned 0 items" };
    }
    return { events: items, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
