// Generic JSON events-API adapter.
//
// Some "html"-typed sources are actually backed by a clean JSON API that the
// site's own widgets use (chamber/ChamberMaster widgets, library calendars,
// community-event portals). Rather than scraping their JS-rendered pages,
// each such source declares the API shape in `source.apiJson`:
//
//   "apiJson": {
//     "method": "GET" | "POST"            (default GET)
//     "query": { ... }                    query params (values may contain {{today}} / {{today+N}})
//     "body": { ... }                     POST body (same token support)
//     "itemsPath": "Value"                dot path to the event array (default: response root)
//     "title": "Name",                    dot path, e.g. "Links[0].url"
//     "start": "StartDate",
//     "end": "EndDate",
//     "allDay": "IsAllDay",
//     "link": "URL",
//     "venue": "Location",
//     "address": "CityState",
//     "description": "Description"
//   }
//
// Items whose start date is missing/unparseable (or predates the year 2000,
// e.g. CitySpark's "0001-01-01" placeholders) are dropped, mirroring the html
// adapter's "must have a real date" rule.

import { USER_AGENT, FETCH_TIMEOUT_MS, parseLooseDate } from "../lib/normalize.mjs";

function pad(n) {
  return String(n).padStart(2, "0");
}

function localDateString(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Replaces {{today}} / {{today+N}} (N in days) tokens in a string.
function fillTokens(str) {
  return str.replace(/\{\{today(\+(\d+))?\}\}/g, (_, __, days) => {
    const d = new Date();
    if (days) d.setDate(d.getDate() + Number(days));
    return localDateString(d);
  });
}

function fillTokensInValue(value) {
  if (typeof value === "string") return fillTokens(value);
  if (Array.isArray(value)) return value.map(fillTokensInValue);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = fillTokensInValue(v);
    return out;
  }
  return value;
}

// Resolves "a.b[0].c" style paths against a JSON object.
function getPath(obj, path) {
  if (!path) return undefined;
  let cur = obj;
  for (const part of path.split(".")) {
    if (cur == null) return undefined;
    const m = part.match(/^(\w+)\[(\d+)\]$/);
    if (m) {
      cur = cur?.[m[1]]?.[Number(m[2])];
    } else {
      cur = cur?.[part];
    }
  }
  return cur;
}

export async function fetchSource(source) {
  const cfg = source.apiJson || {};
  const method = (cfg.method || "GET").toUpperCase();
  const baseUrl = source.url;

  try {
    const url = new URL(baseUrl);
    if (cfg.query) {
      for (const [k, v] of Object.entries(fillTokensInValue(cfg.query))) {
        url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url, {
      method,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: method === "POST" ? JSON.stringify(fillTokensInValue(cfg.body || {})) : undefined,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let items = getPath(data, cfg.itemsPath || "");
    if (items == null) items = data;
    if (!Array.isArray(items)) {
      return { events: [], error: "api-json: response did not contain an array at itemsPath" };
    }

    const events = [];
    const seenKeys = new Set();
    for (const item of items) {
      const title = String(getPath(item, cfg.title) ?? "").trim();
      if (!title) continue;

      const rawStart = getPath(item, cfg.start);
      const start = parseLooseDate(rawStart);
      // Reject placeholder dates (e.g. "0001-01-01") and anything unparseable.
      if (!start || start < "2000-01-01T00:00:00.000Z") continue;

      const rawLink = getPath(item, cfg.link);
      let link = null;
      if (rawLink) {
        try {
          link = new URL(String(rawLink), source.url).toString();
        } catch {
          // skip unparseable link
        }
      }

      const dedupeKey = link || `${title}|${start}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      events.push({
        title,
        description: String(getPath(item, cfg.description) ?? "").trim(),
        start,
        end: parseLooseDate(getPath(item, cfg.end)) || undefined,
        allDay: !!getPath(item, cfg.allDay),
        venue: String(getPath(item, cfg.venue) ?? "").trim(),
        address: String(getPath(item, cfg.address) ?? "").trim(),
        link: link || source.url,
      });
    }

    if (events.length === 0) {
      return {
        events: [],
        error: "api-json: no items with a valid start date in response",
      };
    }
    return { events, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
