import * as cheerio from "cheerio";
import { USER_AGENT, FETCH_TIMEOUT_MS, parseLooseDate } from "../lib/normalize.mjs";

// Deliberately excludes bare "li" — on real sites that matches nav/footer/social
// menus wholesale (confirmed empirically: 285 "events" that were Facebook/Twitch/
// LinkedIn links with no date). Items without a parseable date are filtered out
// below for the same reason.
const DEFAULT_ITEM_SEL = "article, .event, .event-item, [class*='event']";
const DEFAULT_TITLE_SEL = "h1, h2, h3, .title, a";
const DEFAULT_DATE_SEL = "time, .date, .event-date";
const DEFAULT_LINK_SEL = "a";
const HAS_LETTERS = /[a-z]{3}/i;

// Calendar widgets commonly wrap one real event in several matched elements
// (a date badge, a time range, a title block) — each carrying only a fragment
// of text. Stripping weekday/month/am-pm tokens from a candidate title and
// checking what's left filters those fragments out, e.g. "Fri, Sep 11, 2026
// 12:00 PM" reduces to nothing and is rejected as a title.
const DATE_TOKEN =
  /\b(mon|tue|wed|thu|fri|sat|sun|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december|am|pm)\b/gi;

function cleanText(raw) {
  return raw.replace(/\s+/g, " ").trim();
}

function looksLikeDateOnly(text) {
  const stripped = text
    .replace(DATE_TOKEN, "")
    .replace(/[0-9:,.\-–—/]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.length < 3;
}

// When the visible title text is just a date fragment, fall back to the
// event's own detail-page URL slug (e.g. "/events-news/rise-sistahs" ->
// "Rise Sistahs") — a far more reliable title than anything else on the card.
function humanizeSlug(link) {
  try {
    const segments = new URL(link).pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] || "";
    if (!slug.includes("-")) return null; // no hyphen: likely an opaque id, not a real slug
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return null;
  }
}

export async function fetchSource(source) {
  const selectors = source.selectors || {};
  const itemSel = selectors.item || DEFAULT_ITEM_SEL;
  const titleSel = selectors.title || DEFAULT_TITLE_SEL;
  const dateSel = selectors.date || DEFAULT_DATE_SEL;
  const linkSel = selectors.link || DEFAULT_LINK_SEL;

  try {
    const res = await fetch(source.url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    const events = [];
    const seenKeys = new Set();

    $(itemSel).each((_, el) => {
      const $el = $(el);

      const hrefRaw = $el.find(linkSel).first().attr("href");
      let link = null;
      if (hrefRaw) {
        try {
          link = new URL(hrefRaw, source.url).toString();
        } catch {
          // skip unparseable href
        }
      }

      const rawTitleText = cleanText($el.find(titleSel).first().text() || $el.text().slice(0, 120));
      let title = HAS_LETTERS.test(rawTitleText) && !looksLikeDateOnly(rawTitleText) ? rawTitleText : null;
      if (!title && link) title = humanizeSlug(link);
      if (!title) return;

      const $date = $el.find(dateSel).first();
      const rawDate = $date.attr("datetime") || $date.text().trim() || null;
      const start = parseLooseDate(rawDate);
      // No parseable date means this almost certainly isn't a real event card
      // (nav links, social icons, unrelated list items all fail this check).
      if (!start) return;

      // Nested wrapper/badge/content elements around one real event tend to
      // resolve to the same detail link — use it to collapse duplicates.
      const dedupeKey = link || `${title}|${start}`;
      if (seenKeys.has(dedupeKey)) return;
      seenKeys.add(dedupeKey);

      events.push({ title, start, link: link || source.url });
    });

    if (events.length === 0) {
      return {
        events: [],
        error: "no items with a parseable date matched — page likely needs selector tuning or is JS-rendered/bot-blocked",
      };
    }
    return { events, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
