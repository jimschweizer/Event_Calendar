import { FETCH_TIMEOUT_MS } from "../lib/normalize.mjs";

// Note: Eventbrite restricted its public /v3/events/search/ endpoint to select
// partner apps around 2019. A personal token will likely get a 401/403 here —
// that surfaces as a normal per-source error below, not a crash, so the rest
// of the pipeline is unaffected either way.
export async function fetchSource(source) {
  const token = process.env[source.apiKeyEnv];
  if (!token) {
    return { events: [], error: `skipped: no API key configured (set ${source.apiKeyEnv})` };
  }

  const params = new URLSearchParams({
    "location.address": source.locationQuery || "Aurora, IL",
    "location.within": "15mi",
    expand: "venue",
  });
  const url = `${source.url}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const events = (data.events ?? []).map((item) => ({
      title: item.name?.text || "",
      description: item.description?.text || "",
      start: item.start?.utc || null,
      end: item.end?.utc || null,
      venue: item.venue?.name || "",
      address: item.venue?.address?.localized_address_display || "",
      link: item.url || source.url,
      imageUrl: item.logo?.url || null,
    }));

    if (events.length === 0) {
      return { events: [], error: "no events returned for this location" };
    }
    return { events, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
