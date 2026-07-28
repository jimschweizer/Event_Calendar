import * as cheerio from "cheerio";
import { USER_AGENT, FETCH_TIMEOUT_MS } from "../lib/normalize.mjs";

const MAX_DETAIL_PAGES = 8;

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function extractEventNodes(html) {
  const $ = cheerio.load(html);
  const nodes = [];
  const collect = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (node["@graph"]) {
      collect(node["@graph"]);
      return;
    }
    nodes.push(node);
  };

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    try {
      collect(JSON.parse(raw));
    } catch {
      // malformed JSON-LD on this page, skip it
    }
  });

  return nodes.filter((node) => {
    const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
    return types.includes("Event");
  });
}

function schemaEventToRaw(node, fallbackLink) {
  const loc = Array.isArray(node.location) ? node.location[0] : node.location;
  const addr = loc?.address;
  const addressText =
    typeof addr === "string"
      ? addr
      : [addr?.streetAddress, addr?.addressLocality, addr?.addressRegion].filter(Boolean).join(", ");
  const image = Array.isArray(node.image) ? node.image[0] : node.image?.url || node.image;

  return {
    title: node.name || "",
    description: typeof node.description === "string" ? node.description : "",
    start: node.startDate || null,
    end: node.endDate || null,
    venue: loc?.name || "",
    address: addressText || "",
    link: node.url || fallbackLink,
    imageUrl: typeof image === "string" ? image : null,
  };
}

function extractDetailLinks(html, baseUrl, patternStr) {
  const pattern = new RegExp(patternStr || "event", "i");
  const $ = cheerio.load(html);
  const links = new Set();
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    try {
      const abs = new URL(href, baseUrl).toString();
      if (pattern.test(abs)) links.add(abs);
    } catch {
      // ignore unparseable hrefs (mailto:, javascript:, etc.)
    }
  });
  return Array.from(links);
}

export async function fetchSource(source) {
  try {
    const html = await fetchHtml(source.url);
    const events = extractEventNodes(html).map((node) => schemaEventToRaw(node, source.url));

    if (events.length === 0) {
      const links = extractDetailLinks(html, source.url, source.detailLinkPattern).slice(0, MAX_DETAIL_PAGES);
      for (const link of links) {
        try {
          const detailHtml = await fetchHtml(link);
          for (const node of extractEventNodes(detailHtml)) {
            events.push(schemaEventToRaw(node, link));
          }
        } catch {
          // one broken detail page shouldn't sink the whole source
        }
      }
    }

    if (events.length === 0) {
      return { events: [], error: "no Event JSON-LD found on listing or linked detail pages" };
    }
    return { events, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
