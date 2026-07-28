const EVENTS_JSON_URL = "data/events.json";
const QUEUED_SOURCES_KEY = "auroraevents.queuedSources";
const THEME_KEY = "auroraevents.theme";
const DEFAULT_REPO_URL = "https://github.com/jimschweizer/Event_App";

const BUCKET_ORDER = ["Today", "Tomorrow", "This Week", "Later", "Unconfirmed Date"];

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
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

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

// 5. Date Bucketing
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
  if (d.getTime() < today.getTime()) return null; // already past — drop from view
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
    if (!label) continue;
    groups.get(label).push(event);
  }
  return groups;
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

    const heading = document.createElement("h2");
    heading.className = "date-group-heading";
    heading.textContent = label;
    dashboard.appendChild(heading);

    for (const event of items) {
      dashboard.appendChild(renderEventCard(event));
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
}

init();
