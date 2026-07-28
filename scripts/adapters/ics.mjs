import ical from "node-ical";

export async function fetchSource(source) {
  try {
    const data = await ical.async.fromURL(source.url, { timeout: 15000 });
    const events = [];
    for (const key of Object.keys(data)) {
      const item = data[key];
      if (item.type !== "VEVENT") continue;
      events.push({
        title: item.summary || "",
        description: item.description || "",
        start: item.start ? new Date(item.start).toISOString() : null,
        end: item.end ? new Date(item.end).toISOString() : null,
        allDay: item.datetype === "date",
        venue: item.location || "",
        link: item.url || source.url,
      });
    }
    if (events.length === 0) {
      return { events: [], error: "no VEVENT entries found in feed" };
    }
    return { events, error: null };
  } catch (err) {
    return { events: [], error: err.message };
  }
}
