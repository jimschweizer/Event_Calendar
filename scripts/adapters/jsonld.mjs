import * as cheerio from "cheerio";
import { FETCH_TIMEOUT_MS } from "../lib/normalize.mjs";

const MAX_DETAIL_PAGES = 8;
// Ajax Load More listings (WordPress) expose a post__in id list; each id maps to
// one event detail page via ?p={id} (WordPress redirects to the canonical URL).
const MAX_ALM_POSTS = 40;
// Paramount's WAF rate-limits bursts of same-origin requests (HTTP 429), so pace
// the ALM detail fetches and back off when throttled.
const ALM_FETCH_DELAY_MS = 250;

// Some sources (e.g. paramountaurora.com, a WP Engine + Cloudflare WAF site) answer
// 403 to bare requests but pass with a full browser-like header set. Harmless on
// plain sites, and it keeps us out of headless-browser territory.
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

async function fetchPage(url, { retry429 = true } = {}) {
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status !== 429 || !retry429 || attempt >= 2) break;
    await sleep(1000 * (attempt + 1));
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { html: await res.text(), finalUrl: res.url };
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
    if (node["@type"] === "ItemList" && node.itemListElement) {
      collect(node.itemListElement);
      return;
    }
    if (node.item) {
      collect(node.item);
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

// Next.js pages (e.g. Placewise retail sites like shopfoxvalleymall.com) embed the
// whole page state in <script id="__NEXT_DATA__">; event listings live there even
// though the visible DOM is client-rendered. Walk the JSON for objects that look
// like events (a title plus a machine-readable date field) and map them to raws.
function extractNextDataEvents(html, baseUrl) {
  const $ = cheerio.load(html);
  const raw = $('script#__NEXT_DATA__[type="application/json"]').first().text();
  if (!raw) return [];
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }

  const hits = [];
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const occurrence = node.occurrence;
    const start = node.starts_at || occurrence?.start_date || occurrence?.startDate || node.startDate;
    if (typeof node.title === "string" && start && !node["@type"]) {
      hits.push(node);
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(data);

  return hits.map((node) => {
    const occurrence = node.occurrence;
    const image = node.image;
    return {
      title: node.title,
      description:
        typeof node.body === "string"
          ? node.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
          : typeof node.description === "string"
            ? node.description
            : "",
      start: node.starts_at || occurrence?.start_date || occurrence?.startDate || node.startDate,
      end: node.ends_at || occurrence?.end_date || occurrence?.endDate || node.endDate || null,
      venue: typeof node.location === "string" ? node.location : node.location?.name || "",
      address: typeof node.location?.address === "string" ? node.location.address : "",
      link: node.url ? new URL(node.url, baseUrl).toString() : baseUrl,
      imageUrl: typeof image === "string" ? image : image?.url || null,
    };
  });
}

// WordPress "Ajax Load More" exposes its shortcode config in an inline
// `ajax_load_more_vars` object; defaults.post__in lists the post ids of the
// listing (often all of them, page by page). Used to reach event detail pages.
function extractAlmPostIds(html) {
  // The inline script ends with the bare object (no trailing ";"), so anchor on
  // the closing </script> tag rather than "};" — a ";" may only appear later in
  // a following inline script and would over-extend the match.
  const m = html.match(
    /<script[^>]*>(?:\s*var\s+|window\.)?ajax_load_more_vars\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/
  );
  if (!m) return [];
  try {
    const vars = JSON.parse(m[1]);
    const ids = vars?.defaults?.post__in;
    if (typeof ids !== "string") return [];
    return ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
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

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter((e) => {
    const key = `${e.link}|${e.title}|${e.start}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Same-run cache for a listing page's fetch, keyed by URL. Some sources
// deliberately point at the identical listing URL and split it via
// venueFilter (e.g. paramount-theatre / riveredge-park both read
// paramountaurora.com/events/) — caching the page fetch means that counts as
// one request, not two, against a domain that already needs WAF-friendly
// headers and is rate-limited (see BROWSER_HEADERS / ALM_FETCH_DELAY_MS above).
const pageCache = new Map();

function fetchPageCached(url) {
  if (!pageCache.has(url)) {
    pageCache.set(url, fetchPage(url));
  }
  return pageCache.get(url);
}

export async function fetchSource(source) {
  try {
    const { html, finalUrl: listingUrl } = await fetchPageCached(source.url);
    let events = extractEventNodes(html).map((node) => schemaEventToRaw(node, source.url));

    // Fallback 1: events embedded in a Next.js __NEXT_DATA__ payload.
    if (events.length === 0) {
      events = extractNextDataEvents(html, source.url);
    }

    // Fallback 2: WordPress Ajax Load More listing — fetch each post id's detail
    // page (?p={id} redirects to the canonical URL) and read its JSON-LD.
    if (events.length === 0) {
      const postIds = extractAlmPostIds(html);
      if (postIds.length > 0) {
        const origin = new URL("/", source.url).toString();
        for (const id of postIds.slice(0, MAX_ALM_POSTS)) {
          try {
            const detail = await fetchPage(new URL(`?p=${id}`, origin).toString());
            for (const node of extractEventNodes(detail.html)) {
              events.push(schemaEventToRaw(node, detail.finalUrl));
            }
          } catch {
            // one broken detail page shouldn't sink the whole source
          }
          await sleep(ALM_FETCH_DELAY_MS);
        }
      }
    }

    // Fallback 3: generic detail-page discovery from listing-page links.
    if (events.length === 0) {
      const links = extractDetailLinks(html, listingUrl, source.detailLinkPattern).slice(0, MAX_DETAIL_PAGES);
      for (const link of links) {
        try {
          const detail = await fetchPage(link);
          for (const node of extractEventNodes(detail.html)) {
            events.push(schemaEventToRaw(node, link));
          }
        } catch {
          // one broken detail page shouldn't sink the whole source
        }
      }
    }

    let venueFiltered = false;
    if (source.venueFilter) {
      const needle = source.venueFilter.toLowerCase();
      const before = events.length;
      events = events.filter((e) => e.venue.toLowerCase().includes(needle));
      venueFiltered = before > 0 && events.length === 0;
    }

    events = dedupeEvents(events);

    if (events.length === 0) {
      return {
        events: [],
        error: venueFiltered
          ? `no events matched venueFilter "${source.venueFilter}"`
          : "no Event JSON-LD found on listing or linked detail pages",
      };
    }
    return { events, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
