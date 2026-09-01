/* Aurora Events — look & feel preview renderer (shared by preview-option-*.html)
 *
 * Mirrors app.js rendering (date bucketing, category tabs, live search, event
 * cards, propose-a-source panel) so the three preview pages differ ONLY in
 * look & feel. This file is NOT used by the live site (index.html -> app.js).
 */
const BUCKET_ORDER = ["Today", "Tomorrow", "This Week", "Later", "Unconfirmed Date"];

// Embedded sample of real events from data/events.json, used only when the
// preview is opened without a static server (file:// blocks fetch()).
const PREVIEW_FALLBACK = {
  generatedAt: "2026-09-01T14:27:22.549Z",
  sourceStatus: [],
  events: [
    {
      id: "4380280d90e9772d",
      title: "Celebrate Mean Girls Mania!",
      start: "2026-08-26T05:00:00.000Z",
      end: "2026-10-12T05:00:00.000Z",
      allDay: true,
      venue: "Downtown Aurora",
      address: "Downtown Aurora, IL",
      category: "Civic",
      sourceLabel: "Aurora Downtown Happenings",
      link: "https://auroradowntown.org/event/celebrate-mean-girls-mania/",
      imageUrl: null,
      confidence: "high"
    },
    {
      id: "27144840fde3f1a0",
      title: "Mean Girls",
      start: "2026-08-27T00:00:00.000Z",
      end: "2026-10-11T22:30:00.000Z",
      allDay: false,
      venue: "Paramount Theatre",
      address: "23 E Galena Blvd. Aurora, IL 60506",
      category: "Entertainment",
      sourceLabel: "Paramount Theatre",
      link: "https://paramountaurora.com/events/mean-girls/",
      imageUrl: "https://paramountaurora.com/wp-content/uploads/2026/01/MEAN_Website-Sizes800x445.jpg",
      confidence: "medium"
    },
    {
      id: "a1867ef997578957",
      title: "American Red Cross Blood Drive",
      start: "2026-08-28T00:00:00.000Z",
      end: null,
      allDay: false,
      venue: "Cathedral of Grace | St. John",
      address: "Aurora, IL",
      category: "Faith",
      sourceLabel: "Cathedral of Grace | St. John",
      link: "https://www.cogstjohn.org/events-news/american-red-cross-blood-drive",
      imageUrl: null,
      confidence: "medium"
    },
    {
      id: "f82d5bf118bb2dbc",
      title: "Boys V Football VS Fenton High School (Game)",
      start: "2026-08-29T00:00:00.000Z",
      end: "2026-08-29T02:00:00.000Z",
      allDay: false,
      venue: "Roy E. Davis Stadium, 500 Tomcat Lane, Aurora, IL 60505",
      address: "500 Cedar Ave, Aurora, IL",
      category: "Education",
      sourceLabel: "Aurora East High School (D131)",
      link: "https://easthigh.d131.org/fs/calendar-manager/events.ics?calendar_ids=12",
      imageUrl: null,
      confidence: "high"
    },
    {
      id: "1da42d9760d49e0a",
      title: "Rules, Administration, and Procedure Meeting",
      start: "2026-09-01T20:00:00.000Z",
      end: null,
      allDay: false,
      venue: "City Hall - Second Floor Council Chambers",
      address: "44 E Downer Pl, Aurora, IL",
      category: "Civic Meetings",
      sourceLabel: "Aurora City Council & Committee Meetings",
      link: "https://aurora-il.legistar.com/MeetingDetail.aspx?LEGID=4921&GID=308&G=DC7A6B50-7190-431C-A25A-5C223FFADE72",
      imageUrl: null,
      confidence: "high"
    },
    {
      id: "90cf03cd90d74bbe",
      title: "Fall Kid Stage: Oliver Junior Auditions",
      start: "2026-09-01T00:00:00.000Z",
      end: null,
      allDay: false,
      venue: "Fox Valley Park District",
      address: "Aurora, IL",
      category: "Parks & Rec",
      sourceLabel: "Fox Valley Park District",
      link: "https://www.foxvalleyparkdistrict.org/event/fall-kid-stage-oliver-junior-auditions/",
      imageUrl: null,
      confidence: "medium"
    },
    {
      id: "1f2f9b7e011d92d5",
      title: "Still Not Friday: A Stand-Up Comedy Showcase",
      start: "2026-09-03T00:00:00.000Z",
      end: "2026-09-03T00:00:00.000Z",
      allDay: false,
      venue: "Two Brothers Roundhouse",
      address: "205 North Broadway, Aurora, IL",
      category: "Live Music",
      sourceLabel: "Two Brothers Roundhouse",
      link: "https://www.eventbrite.com/e/still-not-friday-a-stand-up-comedy-showcase-tickets-1977569221777",
      imageUrl: "https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F137873557%2F171400129683%2F1%2Foriginal.20210607-151915?w=512&auto=format%2Ccompress&q=75&sharp=10&rect=0%2C44%2C960%2C480&s=ed982b1efe4f50d517c1d666bc92ec06",
      confidence: "medium"
    },
    {
      id: "03f083932faf3dc0",
      title: "First Fridays",
      start: "2026-09-04T22:00:00.000Z",
      end: "2026-09-07T02:00:00.000Z",
      allDay: false,
      venue: "Downtown Aurora",
      address: "Downtown Aurora, IL",
      category: "Civic",
      sourceLabel: "Aurora Downtown Happenings",
      link: "https://auroradowntown.org/event/first-fridays/2026-09-04/",
      imageUrl: null,
      confidence: "high"
    },
    {
      id: "cbad2ba332f3034b",
      title: "Roots & Thirds with Shawn Maxwell feat. Geneva Jazz Ensemble",
      start: "2026-09-04T00:00:00.000Z",
      end: "2026-09-04T00:00:00.000Z",
      allDay: false,
      venue: "THE VENUE",
      address: "21 South Broadway, Aurora, IL 60505",
      category: "Live Music",
      sourceLabel: "The Venue (Fox Valley Music Foundation)",
      link: "https://www.eventbrite.com/e/roots-thirds-with-shawn-maxwell-feat-geneva-jazz-ensemble-tickets-1994992927550",
      imageUrl: "https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F1190542493%2F202636605063%2F1%2Foriginal.20260807-134410?crop=focalpoint&fit=crop&h=230&w=460&auto=format%2Ccompress&q=75&sharp=10&fp-x=0.511&fp-y=0.092&s=2dc8d3fdc3df7dd33b566ede1f8a35db",
      confidence: "medium"
    }
  ]
};

let rawEventsData = { generatedAt: null, events: [] };
let activeCategory = "all";
let filterQuery = "";

const dashboard = document.getElementById("dashboard");
const lastUpdated = document.getElementById("last-updated");
const themeToggle = document.getElementById("theme-toggle");
const toggleSubmitBtn = document.getElementById("toggle-submit-panel");
const submitPanel = document.getElementById("topic-submit-panel");
const closeSubmitBtn = document.getElementById("close-submit-panel");
const proposeForm = document.getElementById("propose-topic-form");
const categoryTabsContainer = document.getElementById("category-tabs");
const searchFilter = document.getElementById("search-filter");
const clearSearchBtn = document.getElementById("clear-search");

// 1. Theme toggle (preview: no persistence needed)
function initTheme() {
  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", current === "dark" ? "light" : "dark");
  });
}

// 2. Propose-a-source panel (preview: buttons are inert)
function initPanel() {
  toggleSubmitBtn.addEventListener("click", () => {
    const isHidden = submitPanel.classList.toggle("hidden");
    toggleSubmitBtn.setAttribute("aria-expanded", !isHidden);
  });
  closeSubmitBtn.addEventListener("click", () => {
    submitPanel.classList.add("hidden");
    toggleSubmitBtn.setAttribute("aria-expanded", "false");
  });
  proposeForm.addEventListener("submit", (e) => e.preventDefault());
}

// 3. Date bucketing (mirrors app.js)
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function bucketFor(startIso, today, tomorrow, weekEnd) {
  if (!startIso) return "Unconfirmed Date";
  const d = startOfDay(new Date(startIso));
  if (Number.isNaN(d.getTime())) return "Unconfirmed Date";
  if (d.getTime() === today.getTime()) return "Today";
  if (d.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (d.getTime() > tomorrow.getTime() && d.getTime() <= weekEnd.getTime()) return "This Week";
  if (d.getTime() < today.getTime()) return null;
  return "Later";
}

function groupEventsByDate(events) {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  const groups = new Map(BUCKET_ORDER.map((label) => [label, []]));
  for (const event of events) {
    const label = bucketFor(event.start, today, tomorrow, weekEnd);
    if (label) groups.get(label).push(event);
  }
  return groups;
}

// 4. Formatting (mirrors app.js)
function formatEventDate(event) {
  if (!event.start) return "Date unknown";
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return "Date unknown";

  const dateOpts = { weekday: "short", month: "short", day: "numeric" };
  const timeOpts = { hour: "numeric", minute: "2-digit" };
  const datePart = start.toLocaleDateString(undefined, dateOpts);
  if (event.allDay) return datePart;

  const timePart = start.toLocaleTimeString(undefined, timeOpts);
  if (event.end) {
    const end = new Date(event.end);
    if (!Number.isNaN(end.getTime()) && end.getTime() !== start.getTime()) {
      const sameDay = start.toDateString() === end.toDateString();
      const endPart = sameDay ? end.toLocaleTimeString(undefined, timeOpts) : end.toLocaleDateString(undefined, dateOpts);
      return `${datePart}, ${timePart} – ${endPart}`;
    }
  }
  return `${datePart}, ${timePart}`;
}

// 5. Event card (mirrors app.js markup: event-card, badges, title, meta, address, source)
function renderEventCard(event) {
  const card = document.createElement("article");
  card.className = "event-card";

  if (event.imageUrl) {
    const img = document.createElement("img");
    img.className = "event-card__image";
    img.src = event.imageUrl;
    img.alt = "";
    img.loading = "lazy";
    card.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "event-card__body";

  const badgeRow = document.createElement("div");
  badgeRow.className = "event-card__badges";
  if (event.category) {
    const tag = document.createElement("span");
    tag.className = "category-badge";
    tag.textContent = event.category;
    badgeRow.appendChild(tag);
  }
  if (event.confidence && event.confidence !== "high") {
    const tag = document.createElement("span");
    tag.className = `confidence-badge confidence-${event.confidence}`;
    tag.textContent = event.confidence === "low" ? "Unconfirmed — verify at source" : "Community-sourced";
    badgeRow.appendChild(tag);
  }
  if (badgeRow.childElementCount > 0) body.appendChild(badgeRow);

  const a = document.createElement("a");
  a.className = "event-title";
  a.href = event.link || "#";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = event.title;
  body.appendChild(a);

  const meta = document.createElement("div");
  meta.className = "event-meta";
  meta.textContent = [formatEventDate(event), event.venue].filter(Boolean).join(" · ");
  body.appendChild(meta);

  if (event.address) {
    const addr = document.createElement("div");
    addr.className = "event-address";
    addr.textContent = event.address;
    body.appendChild(addr);
  }

  const sourceRow = document.createElement("div");
  sourceRow.className = "event-source";
  sourceRow.textContent = `via ${event.sourceLabel}`;
  body.appendChild(sourceRow);

  card.appendChild(body);
  return card;
}

// 6. Category tabs
function renderCategoryTabs() {
  const categoriesSet = new Set();
  for (const event of rawEventsData.events) {
    if (event.category) categoriesSet.add(event.category);
  }
  const categories = Array.from(categoriesSet).sort();

  categoryTabsContainer.innerHTML = "";

  function makeTab(label, cat) {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${activeCategory === cat ? "active" : ""}`;
    btn.dataset.category = cat;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      activeCategory = cat;
      renderCategoryTabs();
      renderDashboard();
    });
    categoryTabsContainer.appendChild(btn);
  }

  makeTab("All Events", "all");
  for (const cat of categories) makeTab(cat, cat);
}

// 7. Dashboard
function renderDashboard() {
  dashboard.innerHTML = "";

  let events = rawEventsData.events.filter(
    (e) => activeCategory === "all" || e.category === activeCategory
  );

  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    events = events.filter(
      (e) =>
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.venue && e.venue.toLowerCase().includes(q)) ||
        (e.sourceLabel && e.sourceLabel.toLowerCase().includes(q)) ||
        (e.category && e.category.toLowerCase().includes(q))
    );
  }

  const groups = groupEventsByDate(events);
  let rendered = 0;

  for (const label of BUCKET_ORDER) {
    const items = groups.get(label);
    if (!items || items.length === 0) continue;
    rendered += items.length;

    const heading = document.createElement("h2");
    heading.className = "date-group-heading";
    heading.textContent = label;
    dashboard.appendChild(heading);

    for (const event of items) {
      dashboard.appendChild(renderEventCard(event));
    }
  }

  if (rendered === 0) {
    const emptyCard = document.createElement("div");
    emptyCard.className = "status-card";
    emptyCard.innerHTML = "<h3>No events found</h3><p>Try clearing your filter or selecting another category tab.</p>";
    dashboard.appendChild(emptyCard);
  }
}

// 8. Init
async function init() {
  initTheme();
  initPanel();

  searchFilter.addEventListener("input", (e) => {
    filterQuery = e.target.value.trim();
    clearSearchBtn.classList.toggle("hidden", !filterQuery);
    renderDashboard();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchFilter.value = "";
    filterQuery = "";
    clearSearchBtn.classList.add("hidden");
    renderDashboard();
  });

  let usedFallback = false;
  try {
    const res = await fetch("data/events.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rawEventsData = await res.json();
  } catch (err) {
    console.error("Preview: failed to load data/events.json — using embedded sample.", err);
    rawEventsData = PREVIEW_FALLBACK;
    usedFallback = true;
  }

  if (rawEventsData.generatedAt) {
    const statuses = rawEventsData.sourceStatus || [];
    const okCount = statuses.filter((s) => s.ok).length;
    const liveNote = statuses.length ? ` · ${okCount}/${statuses.length} sources live` : "";
    lastUpdated.textContent =
      `Last refresh: ${new Date(rawEventsData.generatedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${liveNote}`;
  }

  if (usedFallback) {
    lastUpdated.textContent = "Preview sample data — run `npm run serve` for the live event feed.";
    const banner = document.querySelector(".preview-banner");
    if (banner) banner.textContent += " · SAMPLE DATA";
  }

  renderCategoryTabs();
  renderDashboard();
}

init();
