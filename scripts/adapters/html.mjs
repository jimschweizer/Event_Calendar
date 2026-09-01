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

// Month names used for extracting a date out of free text.
const MONTH_NAME =
  "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
// "October 23, 2026" (also tolerates "October 23 - 24, 2026" and "Sept 9th, 2026"
// and trailing junk like time ranges / timezone abbreviations after the year).
const MONTH_DAY_YEAR_RE = new RegExp(
  `\\b(${MONTH_NAME})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*[-–—]\\s*\\d{1,2}(?:st|nd|rd|th)?)?,?\\s+(\\d{4})`,
  "i"
);
// Bare "July 12" with no year — only accepted when it lands today or later, so
// year-less listings never produce stale or guessed dates.
const MONTH_DAY_ONLY_RE = new RegExp(
  `\\b(${MONTH_NAME})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?`,
  "i"
);

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

// Resolves the start date for one matched element. Real-world pages hide dates
// in several ways, so this tries, in order:
//   1. a `datetime` attribute (the classic <time> pattern)
//   2. an itemprop `content` attribute (e.g. Simple Calendar's
//      <span itemprop="startDate" content="2026-09-01T08:00:00-05:00">)
//   3. the element's own text, parsed directly
//   4. a "Month D, YYYY" fragment extracted from free text (dates with
//      trailing time ranges / timezone text like "September 12, 2026 from
//      10:00am - 12:00pm CDT")
//   5. a bare "Month D" fragment — accepted only when it lands today or in the
//      future (church sites often drop the year from current-year listings)
function resolveStartDate($date) {
  const raw = $date.attr("datetime") || $date.attr("content") || $date.text().trim() || null;
  if (!raw) return null;

  const direct = parseLooseDate(raw);
  // V8's lenient date parser invents years for year-less fragments
  // ("Placinta and Langos, July 12" -> 2001, "March 24-31" -> 2031), so only
  // trust a direct parse when the text carries an explicit 4-digit year and
  // the year is plausibly current; otherwise fall through to month/day
  // extraction below.
  const hasExplicitYear = /\b\d{4}\b/.test(raw);
  const directYear = direct ? Number(direct.slice(0, 4)) : 0;
  const currentYear = new Date().getFullYear();
  if (
    direct &&
    hasExplicitYear &&
    directYear >= currentYear - 1 &&
    directYear <= currentYear + 5
  ) {
    return direct;
  }

  const withYear = raw.match(MONTH_DAY_YEAR_RE);
  if (withYear) {
    const candidate = `${withYear[1]} ${withYear[2]}, ${withYear[3]}`;
    return parseLooseDate(candidate);
  }

  const bare = raw.match(MONTH_DAY_ONLY_RE);
  if (bare) {
    const now = new Date();
    const candidate = new Date(`${bare[1]} ${bare[2]}, ${now.getFullYear()}`);
    if (Number.isNaN(candidate.getTime())) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (candidate >= today) return candidate.toISOString();
    return null;
  }

  return null;
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
      const start = resolveStartDate($date);
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
