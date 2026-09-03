const EVENTS_JSON_URL = "data/events.json";
const QUEUED_SOURCES_KEY = "auroraevents.queuedSources";
const THEME_KEY = "auroraevents.theme";
const DEFAULT_REPO_URL = "https://github.com/jimschweizer/Event_Calendar";

// Every listed event happens in the Aurora / Fox Valley area, so dates and
// times are always shown as America/Chicago (venue-local) wall clock — never
// the viewer's own timezone — and day bucketing uses Chicago calendar days.
const EVENT_TIME_ZONE = "America/Chicago";

const BUCKET_ORDER = ["Today", "Tomorrow", "This Week", "Later", "Unconfirmed Date"];

// Dashboard constraints & per-section category priority. "This Week" draws
// live-event listings (Live Music) and Entertainment forward; "Today" draws
// Civic and Entertainment forward. Sections not listed sort by start time.
const MAX_EVENTS_PER_SECTION = 10;
const SECTION_PRIORITY = {
  Today: ["Civic", "Entertainment"],
  "This Week": ["Live Music", "Entertainment"],
};

// DOM Elements
const dashboard = document.getElementById("dashboard");
const lastUpdated = document.getElementById("last-updated");
const repoLink = document.getElementById("repo-link");
const sourcesLink = document.getElementById("sources-link");
const themeToggle = document.getElementById("theme-toggle");

const toggleSubmitBtn = document.getElementById("toggle-submit-panel");
const submitPanel = document.getElementById("topic-submit-panel");
const closeSubmitBtn = document.getElementById("close-submit-panel");
const proposeForm = document.getElementById("propose-topic-form");
const topicInput = document.getElementById("topic-input");
const topicVenueInput = document.getElementById("topic-venue");
const topicTypeSelect = document.getElementById("topic-type");
const topicCategorySelect = document.getElementById("topic-category");

const btnGhIssue = document.getElementById("btn-gh-issue");
const btnGhPr = document.getElementById("btn-gh-pr");
const btnLocalQueue = document.getElementById("btn-local-queue");
const btnCopyJson = document.getElementById("btn-copy-json");

const categoryTabsContainer = document.getElementById("category-tabs");
const searchFilter = document.getElementById("search-filter");
const clearSearchBtn = document.getElementById("clear-search");

// State
let rawEventsData = { generatedAt: null, events: [], sourceStatus: [] };
let activeCategory = "all";
let filterQuery = "";

// 1. Theme Management
function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme);
  } else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }

  themeToggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  });
}

// 2. Repository Link Helper
function getRepoUrl() {
  const host = window.location.hostname;
  if (host.endsWith(".github.io")) {
    const owner = host.split(".")[0];
    const pathSegments = window.location.pathname.split("/").filter(Boolean);
    const repo = pathSegments[0] || "Event_App";
    return `https://github.com/${owner}/${repo}`;
  }
  return DEFAULT_REPO_URL;
}

function initRepoLinks() {
  const url = getRepoUrl();
  if (repoLink) repoLink.href = url;
  if (sourcesLink) sourcesLink.href = `${url}/blob/main/data/sources.json`;
}

// 3. Source Submission Panel & GitHub Automation
function initSubmitPanel() {
  toggleSubmitBtn.addEventListener("click", () => {
    const isHidden = submitPanel.classList.toggle("hidden");
    toggleSubmitBtn.setAttribute("aria-expanded", !isHidden);
    if (!isHidden) topicInput.focus();
  });

  closeSubmitBtn.addEventListener("click", () => {
    submitPanel.classList.add("hidden");
    toggleSubmitBtn.setAttribute("aria-expanded", "false");
  });

  function buildSourceObject() {
    const url = topicInput.value.trim();
    if (!url || !/^https?:\/\//i.test(url)) return null;

    const category = topicCategorySelect.value || "General";
    const type = topicTypeSelect.value || "html";
    const venue = topicVenueInput.value.trim() || url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
    const slug = slugify(venue);

    return { id: slug, label: venue, category, venue, type, url };
  }

  // Submit via GitHub Issue
  btnGhIssue.addEventListener("click", () => {
    const sourceObj = buildSourceObject();
    if (!sourceObj) {
      alert("Please enter a valid http(s) URL.");
      return;
    }
    const repo = getRepoUrl();
    const title = encodeURIComponent(`Add Source: ${sourceObj.label}`);
    const snippet = JSON.stringify(sourceObj, null, 2);
    const body = encodeURIComponent(
      `### Proposed New Aurora Events Source\n\n\`\`\`json\n${snippet}\n\`\`\`\n\n*Submitted via Aurora Events Dashboard 1-Click Action.*`
    );
    window.open(`${repo}/issues/new?title=${title}&body=${body}`, "_blank");
  });

  // 1-Click PR (GitHub Edit File)
  btnGhPr.addEventListener("click", () => {
    const sourceObj = buildSourceObject();
    if (!sourceObj) {
      alert("Please enter a valid http(s) URL.");
      return;
    }
    const repo = getRepoUrl();
    const snippet = JSON.stringify(sourceObj, null, 2);
    navigator.clipboard.writeText(snippet).then(() => {
      alert(`Copied JSON snippet for "${sourceObj.label}" to clipboard!\nOpening GitHub file editor...`);
      window.open(`${repo}/edit/main/data/sources.json`, "_blank");
    }).catch(() => {
      window.open(`${repo}/edit/main/data/sources.json`, "_blank");
    });
  });

  // Copy JSON Snippet
  btnCopyJson.addEventListener("click", async () => {
    const sourceObj = buildSourceObject();
    if (!sourceObj) return;
    const snippet = JSON.stringify(sourceObj, null, 2);
    try {
      await navigator.clipboard.writeText(snippet);
      btnCopyJson.textContent = "Copied!";
      setTimeout(() => (btnCopyJson.textContent = "Copy JSON Snippet"), 1800);
    } catch {
      alert(snippet);
    }
  });

  // Local Storage Queue Fallback
  proposeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const sourceObj = buildSourceObject();
    if (!sourceObj) return;
    sourceObj.id = "queued-" + sourceObj.id;

    const queued = loadQueuedSources();
    if (!queued.some((s) => s.id === sourceObj.id)) {
      queued.push(sourceObj);
      saveQueuedSources(queued);
    }
    topicInput.value = "";
    topicVenueInput.value = "";
    submitPanel.classList.add("hidden");
    renderDashboard();
  });
}

// 4. Utility Functions
function slugify(text) {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `source-${Date.now()}`
  );
}

function loadQueuedSources() {
  try {
    return JSON.parse(localStorage.getItem(QUEUED_SOURCES_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueuedSources(sources) {
  localStorage.setItem(QUEUED_SOURCES_KEY, JSON.stringify(sources));
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  });
}

// Calendar-day helpers anchored to America/Chicago (venue-local).
function chicagoParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  return { year: get("year"), month: get("month"), day: get("day") };
}

function dayKeyFromParts(parts) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// "YYYY-MM-DD" calendar date of an instant in America/Chicago (null if invalid).
function chicagoDayKey(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return dayKeyFromParts(chicagoParts(d));
}

function chicagoTodayKey() {
  return dayKeyFromParts(chicagoParts(new Date()));
}

// Adds n calendar days to a "YYYY-MM-DD" Chicago day key. The anchor sits at
// 12:00 UTC, which is always mid-day in Chicago, so DST 23/25-hour days can't
// skip or duplicate a calendar date.
function shiftChicagoDay(key, n) {
  const [y, m, d] = key.split("-").map(Number);
  const anchor = new Date(Date.UTC(y, m - 1, d + n, 12));
  return chicagoDayKey(anchor.toISOString());
}

function formatEventDate(event) {
  if (!event.start) return "Date unknown";
  const start = new Date(event.start);
  if (Number.isNaN(start.getTime())) return "Date unknown";

  const dateOpts = { weekday: "short", month: "short", day: "numeric", timeZone: EVENT_TIME_ZONE };
  const timeOpts = { hour: "numeric", minute: "2-digit", timeZone: EVENT_TIME_ZONE };
  const datePart = start.toLocaleDateString(undefined, dateOpts);

  if (event.allDay) return datePart;

  const timePart = start.toLocaleTimeString(undefined, timeOpts);
  if (event.end) {
    const end = new Date(event.end);
    if (!Number.isNaN(end.getTime()) && end.getTime() !== start.getTime()) {
      const sameDay = chicagoDayKey(event.start) === chicagoDayKey(event.end);
      const endPart = sameDay ? end.toLocaleTimeString(undefined, timeOpts) : end.toLocaleDateString(undefined, dateOpts);
      return `${datePart}, ${timePart} – ${endPart}`;
    }
  }
  return `${datePart}, ${timePart}`;
}

// 5. Date Bucketing
function bucketFor(startIso, todayKey, tomorrowKey, weekEndKey) {
  if (!startIso) return "Unconfirmed Date";
  const key = chicagoDayKey(startIso);
  if (!key) return "Unconfirmed Date";
  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";
  if (key > tomorrowKey && key <= weekEndKey) return "This Week";
  if (key < todayKey) return null; // already past — drop from view
  return "Later";
}

function groupEventsByDate(events) {
  const todayKey = chicagoTodayKey();
  const tomorrowKey = shiftChicagoDay(todayKey, 1);
  const weekEndKey = shiftChicagoDay(todayKey, 7);

  const groups = new Map(BUCKET_ORDER.map((label) => [label, []]));
  for (const event of events) {
    const label = bucketFor(event.start, todayKey, tomorrowKey, weekEndKey);
    if (!label) continue;
    groups.get(label).push(event);
  }
  return groups;
}

// Rank of an event's category inside a section (listed categories 0..n-1 in
// order, everything else rank n), so priority sections sort category-first.
function sectionPriorityRank(category, sectionLabel) {
  const order = SECTION_PRIORITY[sectionLabel] || [];
  const idx = order.indexOf(category);
  return idx === -1 ? order.length : idx;
}

function sortSectionEvents(events, sectionLabel) {
  return events.slice().sort((a, b) => {
    const ra = sectionPriorityRank(a.category, sectionLabel);
    const rb = sectionPriorityRank(b.category, sectionLabel);
    if (ra !== rb) return ra - rb;
    return new Date(a.start || 0) - new Date(b.start || 0);
  });
}

// Section heading with a live count chip, e.g. "Today · 54 events".
function renderSectionHeading(label, total) {
  const heading = document.createElement("h2");
  heading.className = "date-group-heading";

  const name = document.createElement("span");
  name.className = "date-group-heading__name";
  name.textContent = label;

  const chip = document.createElement("span");
  chip.className = "group-count";
  chip.textContent = `${total} ${total === 1 ? "event" : "events"}`;

  heading.append(name, chip);
  return heading;
}

let overflowMenuCounter = 0;

// Drop-down menu holding every event beyond the first 10 of a section. Rows
// are links that open the event in a new tab; the trigger toggles the menu.
function renderOverflowMenu(sectionLabel, overflowEvents) {
  const block = document.createElement("div");
  block.className = "overflow-block";

  const menuId = `overflow-menu-${++overflowMenuCounter}`;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "overflow-trigger";
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-controls", menuId);

  const triggerLabel = document.createElement("span");
  triggerLabel.className = "overflow-trigger__label";
  triggerLabel.textContent = `${overflowEvents.length} more ${sectionLabel.toLowerCase()} events`;

  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.setAttribute("viewBox", "0 0 24 24");
  chevron.setAttribute("width", "16");
  chevron.setAttribute("height", "16");
  chevron.setAttribute("fill", "none");
  chevron.setAttribute("stroke", "currentColor");
  chevron.setAttribute("stroke-width", "2");
  chevron.setAttribute("aria-hidden", "true");
  chevron.classList.add("overflow-trigger__chevron");
  const chevronPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  chevronPath.setAttribute("d", "M6 9l6 6 6-6");
  chevron.appendChild(chevronPath);

  trigger.append(triggerLabel, chevron);
  block.appendChild(trigger);

  const menu = document.createElement("div");
  menu.className = "overflow-menu";
  menu.id = menuId;
  menu.hidden = true;

  const list = document.createElement("ol");
  list.className = "overflow-list";
  for (const event of overflowEvents) {
    const li = document.createElement("li");
    const row = document.createElement("a");
    row.className = "overflow-row";
    row.href = event.link || "#";
    row.target = "_blank";
    row.rel = "noopener noreferrer";

    const title = document.createElement("span");
    title.className = "overflow-row__title";
    title.textContent = event.title;

    const meta = document.createElement("span");
    meta.className = "overflow-row__meta";
    meta.textContent = [formatEventDate(event), event.venue].filter(Boolean).join(" · ");

    row.append(title, meta);
    li.appendChild(row);
    list.appendChild(li);
  }
  menu.appendChild(list);
  block.appendChild(menu);

  return block;
}

function closeOverflowMenu(menu) {
  menu.hidden = true;
  const block = menu.closest(".overflow-block");
  const trigger = block && block.querySelector(".overflow-trigger");
  if (trigger) trigger.setAttribute("aria-expanded", "false");
}

// One-shot delegated listeners (registered in init) so re-renders never
// accumulate handlers. Only one overflow menu is open at a time; clicking
// anywhere else or pressing Escape closes any open menu.
function initOverflowInteractions() {
  document.addEventListener("click", (e) => {
    const trigger = e.target.closest(".overflow-trigger");
    if (trigger) {
      const menu = document.getElementById(trigger.getAttribute("aria-controls"));
      if (!menu) return;
      const willOpen = menu.hidden;
      dashboard.querySelectorAll(".overflow-menu:not([hidden])").forEach(closeOverflowMenu);
      if (willOpen) {
        menu.hidden = false;
        trigger.setAttribute("aria-expanded", "true");
      }
      return;
    }
    if (!e.target.closest(".overflow-block")) {
      dashboard.querySelectorAll(".overflow-menu:not([hidden])").forEach(closeOverflowMenu);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dashboard.querySelectorAll(".overflow-menu:not([hidden])").forEach(closeOverflowMenu);
    }
  });
}

// 6. Category Tabs Renderer
function renderCategoryTabs() {
  const categoriesSet = new Set();
  for (const event of rawEventsData.events) {
    if (event.category) categoriesSet.add(event.category);
  }
  const queued = loadQueuedSources();
  for (const s of queued) {
    if (s.category) categoriesSet.add(s.category);
  }

  const categories = Array.from(categoriesSet).sort();

  categoryTabsContainer.innerHTML = "";

  const allBtn = document.createElement("button");
  allBtn.className = `tab-btn ${activeCategory === "all" ? "active" : ""}`;
  allBtn.dataset.category = "all";
  allBtn.textContent = "All Events";
  allBtn.addEventListener("click", () => setCategory("all"));
  categoryTabsContainer.appendChild(allBtn);

  for (const cat of categories) {
    const btn = document.createElement("button");
    btn.className = `tab-btn ${activeCategory === cat ? "active" : ""}`;
    btn.dataset.category = cat;
    btn.textContent = cat;
    btn.addEventListener("click", () => setCategory(cat));
    categoryTabsContainer.appendChild(btn);
  }
}

function setCategory(cat) {
  activeCategory = cat;
  renderCategoryTabs();
  renderDashboard();
}

// 7. Event Card Renderer
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
    const catTag = document.createElement("span");
    catTag.className = "category-badge";
    catTag.textContent = event.category;
    badgeRow.appendChild(catTag);
  }
  if (event.confidence && event.confidence !== "high") {
    const confTag = document.createElement("span");
    confTag.className = `confidence-badge confidence-${event.confidence}`;
    confTag.textContent = event.confidence === "low" ? "Unconfirmed — verify at source" : "Community-sourced";
    badgeRow.appendChild(confTag);
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

function renderQueuedSourceCard(source) {
  const card = document.createElement("section");
  card.className = "event-card queued-source";

  const badgeRow = document.createElement("div");
  badgeRow.className = "event-card__badges";
  const tag = document.createElement("span");
  tag.className = "category-badge";
  tag.textContent = "queued in browser";
  badgeRow.appendChild(tag);
  card.appendChild(badgeRow);

  const h3 = document.createElement("h3");
  h3.className = "event-title";
  h3.textContent = source.label;
  card.appendChild(h3);

  const meta = document.createElement("div");
  meta.className = "event-meta";
  meta.textContent = `${source.type} · ${source.category}`;
  card.appendChild(meta);

  const p = document.createElement("p");
  p.className = "topic-empty";
  p.textContent = "Saved locally. Click 'Propose a Source' above to submit a GitHub Issue or PR to include it in official runs.";
  card.appendChild(p);

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn-icon";
  removeBtn.type = "button";
  removeBtn.textContent = "✕ Remove";
  removeBtn.addEventListener("click", () => {
    const queued = loadQueuedSources().filter((s) => s.id !== source.id);
    saveQueuedSources(queued);
    renderDashboard();
  });
  card.appendChild(removeBtn);

  return card;
}

// 8. Main Dashboard Renderer
function renderDashboard() {
  dashboard.innerHTML = "";

  let events = rawEventsData.events.filter(
    (e) => activeCategory === "all" || e.category === activeCategory
  );

  if (filterQuery) {
    const q = filterQuery.toLowerCase();
    events = events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
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

    const sorted = sortSectionEvents(items, label);
    const visible = sorted.slice(0, MAX_EVENTS_PER_SECTION);
    const overflow = sorted.slice(MAX_EVENTS_PER_SECTION);

    dashboard.appendChild(renderSectionHeading(label, items.length));
    for (const event of visible) {
      dashboard.appendChild(renderEventCard(event));
    }
    if (overflow.length > 0) {
      dashboard.appendChild(renderOverflowMenu(label, overflow));
    }
  }

  const queued = loadQueuedSources().filter(
    (s) => activeCategory === "all" || s.category === activeCategory
  );
  if (queued.length > 0) {
    const heading = document.createElement("h2");
    heading.className = "date-group-heading";
    heading.textContent = "Proposed Sources (pending review)";
    dashboard.appendChild(heading);
    for (const source of queued) {
      dashboard.appendChild(renderQueuedSourceCard(source));
      rendered++;
    }
  }

  if (rendered === 0) {
    const emptyCard = document.createElement("div");
    emptyCard.className = "status-card";
    emptyCard.innerHTML = `<h3>No events found</h3><p>Try clearing your filter or selecting another category tab.</p>`;
    dashboard.appendChild(emptyCard);
  }
}

// 9. Initializer & Search Filter Event Handling
async function init() {
  initTheme();
  initRepoLinks();
  initSubmitPanel();
  initOverflowInteractions();

  // Search Filter Handler
  searchFilter.addEventListener("input", (e) => {
    filterQuery = e.target.value.trim();
    if (filterQuery) {
      clearSearchBtn.classList.remove("hidden");
    } else {
      clearSearchBtn.classList.add("hidden");
    }
    renderDashboard();
  });

  clearSearchBtn.addEventListener("click", () => {
    searchFilter.value = "";
    filterQuery = "";
    clearSearchBtn.classList.add("hidden");
    renderDashboard();
  });

  // Fetch JSON
  try {
    const res = await fetch(EVENTS_JSON_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rawEventsData = await res.json();
  } catch (err) {
    console.error("Failed to load events.json", err);
  }

  if (rawEventsData.generatedAt) {
    const statuses = rawEventsData.sourceStatus || [];
    const okCount = statuses.filter((s) => s.ok).length;
    const liveNote = statuses.length ? ` · ${okCount}/${statuses.length} sources live` : "";
    lastUpdated.textContent = `Last refresh: ${formatDate(rawEventsData.generatedAt)}${liveNote}`;
  } else {
    lastUpdated.textContent = "Background data pending.";
  }

  renderCategoryTabs();
  renderDashboard();

  // The loading card sits outside #dashboard now; remove it once the first
  // render is complete (success or failure — the empty state speaks for itself).
  const statusMessage = document.getElementById("status-message");
  if (statusMessage) statusMessage.remove();
}

init();
