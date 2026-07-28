import { FETCH_TIMEOUT_MS } from "../lib/normalize.mjs";

export async function fetchSource(source) {
  const apiKey = process.env[source.apiKeyEnv];
  if (!apiKey) {
    return { events: [], error: `skipped: no API key configured (set ${source.apiKeyEnv})` };
  }

  const params = new URLSearchParams({
    apikey: apiKey,
    city: source.city || "Aurora",
    stateCode: source.stateCode || "IL",
    countryCode: "US",
    size: "50",
  });
  const url = `${source.url}?${params.toString()}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const raw = data._embedded?.events ?? [];
    const events = raw.map((item) => {
      const venue = item._embedded?.venues?.[0];
      const dateTime = item.dates?.start?.dateTime;
      const localDate = item.dates?.start?.localDate;
      return {
        title: item.name || "",
        description: item.info || item.pleaseNote || "",
        start: dateTime || (localDate ? `${localDate}T00:00:00` : null),
        allDay: !dateTime && !!localDate,
        venue: venue?.name || "",
        address: [venue?.address?.line1, venue?.city?.name, venue?.state?.stateCode].filter(Boolean).join(", "),
        link: item.url || source.url,
        imageUrl: item.images?.[0]?.url || null,
      };
    });

    if (events.length === 0) {
      return { events: [], error: "no events returned for this location" };
    }
    return { events, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
