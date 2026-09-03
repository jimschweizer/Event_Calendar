# Dashboard Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Aurora Events dashboard frontend so a static FEATURED event is pinned on top, every date section shows at most 10 events with the remainder behind a per-section drop-down menu, and Today / This Week sort priority categories first.

**Architecture:** Pure frontend change. `index.html` gains a static `#featured-section` hero outside the JS-managed `#dashboard` grid; `style.css` adds hero, count-chip, and overflow-menu styles; `app.js` sorts each section with per-section category priority, caps it at 10 cards, and renders an accessible drop-down for the overflow. `data/events.json` and all pipeline scripts are untouched.

**Tech Stack:** Vanilla HTML/CSS/JS (no framework). No test framework exists in the repo, so each task's verification steps are syntax checks plus served-page / headless-browser assertions (see Task 5 for the browser commands).

**Design doc:** `docs/plans/2026-09-03-dashboard-redesign-design.md` (approved).

**Decision log (from design doc):**
- "live-events" = the **Live Music** category.
- Buckets stay: Today / Tomorrow / This Week / Later / Unconfirmed Date (+ Proposed Sources block).
- Overflow = styled drop-down menu (compact rows that open events in new tabs).
- FEATURED is always pinned at top, in every view.
- Priority order: **Today** = Civic → Entertainment → rest; **This Week** = Live Music → Entertainment → rest; other sections = start time only.

---

### Task 1: index.html — restructure main, add static FEATURED hero

**Files:**
- Modify: `index.html:132-137` (the `<main>` block)

**Step 1: Read the current main block**

Read `index.html` lines 130-140 to confirm it still reads:

```html
  <main id="dashboard" class="dashboard">
    <div id="status-message" class="status-card">
      <div class="spinner"></div>
      <p>Fetching latest events snapshot…</p>
    </div>
  </main>
```

**Step 2: Replace the main block**

Replace that whole `<main>...</main>` block with:

```html
  <main>
    <div id="status-message" class="status-card">
      <div class="spinner"></div>
      <p>Fetching latest events snapshot…</p>
    </div>

    <!-- Static FEATURED event — pinned above every dashboard view -->
    <section id="featured-section" class="featured-section" aria-label="Featured event">
      <div class="featured-card">
        <div class="featured-card__tag-row">
          <span class="featured-badge">FEATURED</span>
          <span class="category-badge">Entertainment</span>
        </div>
        <h2 class="featured-card__title">Quantum Prairie After Dark</h2>
        <p class="featured-card__desc">
          After-dark nightlife at Quantum Prairie — the craft-cocktail lounge inside
          Two Brothers Roundhouse in downtown Aurora.
        </p>
        <p class="featured-card__meta">Two Brothers Roundhouse · 205 N. Broadway, Aurora, IL</p>
        <a
          class="btn btn--primary featured-card__cta"
          href="https://www.eventbrite.com/e/quantum-prairie-after-dark-tickets-1998799157085?aff=oddtdtcreator"
          target="_blank"
          rel="noopener noreferrer"
        >
          View listing on Eventbrite&nbsp;↗
        </a>
      </div>
    </section>

    <div id="dashboard" class="dashboard">
      <!-- Date-bucket sections rendered by app.js -->
    </div>
  </main>
```

Notes:
- `#status-message` and `#featured-section` now live **outside** `#dashboard`, so `renderDashboard()`'s `innerHTML = ""` can never wipe them. `app.js` keeps `dashboard = document.getElementById("dashboard")` resolving to the grid div — no JS DOM lookup changes needed.
- The featured text is intentionally honest (no invented date/image — Eventbrite is unreachable from the dev machine). Copy/links are all in this one block.

**Step 3: Verify structure**

Run: `node --check app.js` (must not need changes yet — confirms nothing broke syntactically is not the point; skip if unchanged). Instead verify the HTML parses and the anchors resolve:

Run: `Select-String -Path index.html -Pattern 'featured-section|eventbrite.com/e/quantum-prairie'` — expect 3+ matches including the full Eventbrite URL.

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: static FEATURED hero above dashboard (Quantum Prairie After Dark)"
```

---

### Task 2: style.css — hero, count chips, overflow drop-down

**Files:**
- Modify: `style.css` (append new sections before the `/* Responsive queries */` media block at line ~662; add featured/status/overflow rules to the existing 768px media query)

**Step 1: Add top-level layout + featured hero + chip + overflow styles**

Insert before `/* Responsive queries */`:

```css
/* Status card & FEATURED hero now sit above the dashboard grid */
#status-message.status-card {
  max-width: 1400px;
  margin: 1.5rem auto 0;
  padding: 2rem 1.5rem;
}

/* Static FEATURED hero — pinned at top of the page */
.featured-section {
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
  padding: 1.5rem 1.5rem 0;
}

.featured-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, var(--bg-surface-elevated), var(--bg-surface) 55%);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  padding: 1.6rem 1.8rem;
  box-shadow: var(--card-shadow);
}

/* Top accent bar + soft spotlight wash */
.featured-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: linear-gradient(90deg, var(--accent-primary), var(--accent-cyan), var(--accent-green));
}

.featured-card::after {
  content: "";
  position: absolute;
  top: -40%;
  right: -10%;
  width: 420px;
  height: 420px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent-light), transparent 65%);
  pointer-events: none;
}

.featured-card__tag-row {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.featured-badge {
  font-family: var(--font-brand);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #ffffff;
  background: linear-gradient(135deg, var(--accent-primary), var(--accent-cyan));
  padding: 0.22rem 0.65rem;
  border-radius: 999px;
  box-shadow: 0 2px 10px rgba(99, 102, 241, 0.35);
}

.featured-card__title {
  position: relative;
  font-family: var(--font-brand);
  font-size: clamp(1.5rem, 2.6vw, 2.1rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.15;
  margin: 0.6rem 0 0.35rem;
}

.featured-card__desc {
  position: relative;
  color: var(--text-muted);
  font-size: 0.95rem;
  max-width: 62ch;
}

.featured-card__meta {
  position: relative;
  color: var(--text-subtle);
  font-size: 0.8rem;
  margin: 0.2rem 0 1rem;
}

/* Dashboard grid now only holds rendered sections */
.dashboard {
  padding: 0 1.5rem 1.5rem;
}

/* Section heading with live count chip */
.date-group-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.group-count {
  font-family: var(--font-brand);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text-muted);
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  padding: 0.18rem 0.65rem;
  white-space: nowrap;
}

/* Section overflow: trigger + drop-down menu of remaining events */
.overflow-block {
  grid-column: 1 / -1;
}

.overflow-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.85rem 1.15rem;
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--accent-primary);
  background: var(--bg-surface);
  border: 1px dashed rgba(99, 102, 241, 0.45);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.overflow-trigger:hover,
.overflow-trigger[aria-expanded="true"] {
  background: var(--accent-light);
  border-style: solid;
  border-color: var(--accent-primary);
}

.overflow-trigger__chevron {
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.overflow-trigger[aria-expanded="true"] .overflow-trigger__chevron {
  transform: rotate(180deg);
}

.overflow-menu {
  margin-top: 0.6rem;
  max-height: min(480px, 60vh);
  overflow-y: auto;
  background: var(--bg-surface-elevated);
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  box-shadow: var(--glass-shadow);
}

.overflow-menu[hidden] {
  display: none;
}

.overflow-list {
  list-style: none;
  display: flex;
  flex-direction: column;
}

.overflow-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 1.1rem;
  text-decoration: none;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.15s ease;
}

.overflow-row:last-child {
  border-bottom: none;
}

.overflow-row:hover {
  background: var(--bg-main);
}

.overflow-row__title {
  color: var(--text-main);
  font-size: 0.88rem;
  font-weight: 600;
  transition: color 0.15s ease;
}

.overflow-row:hover .overflow-row__title {
  color: var(--accent-primary);
}

.overflow-row__meta {
  color: var(--text-subtle);
  font-size: 0.78rem;
  text-align: right;
  white-space: nowrap;
}
```

**Step 2: Extend the existing 768px media query**

Inside the existing `@media (max-width: 768px) { ... }` block (before its closing brace) add:

```css
  .featured-card {
    padding: 1.2rem 1.15rem;
  }
```

Then append a new small-screen rule after that media query:

```css
@media (max-width: 640px) {
  .overflow-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }

  .overflow-row__meta {
    text-align: left;
    white-space: normal;
  }
}
```

**Step 3: Verify braces balance**

Run: `node -e "const css = require('fs').readFileSync('style.css','utf8'); const open=(css.match(/\{/g)||[]).length, close=(css.match(/\}/g)||[]).length; console.log('open',open,'close',close); if(open!==close) process.exit(1)"` — expect `open N close N` equal and exit 0.

**Step 4: Commit**

```bash
git add style.css
git commit -m "style: featured hero, section count chips, overflow drop-down styles"
```

---

### Task 3: app.js — priority sorting, 10-card cap, overflow drop-down

**Files:**
- Modify: `app.js`
  - constants near `BUCKET_ORDER` (line ~11)
  - new helper functions + overflow renderer (before section 7 "Event Card Renderer" or after section 7)
  - `renderDashboard()` (lines 433-489)
  - `init()` (lines 492-535): register delegated overflow listeners once; remove `#status-message` after first render

**Step 1: Add constants**

After the `BUCKET_ORDER` line (line 11), add:

```js
// Dashboard constraints & per-section category priority. "This Week" draws
// live-event listings (Live Music) and Entertainment forward; "Today" draws
// Civic and Entertainment forward. Sections not listed sort by start time.
const MAX_EVENTS_PER_SECTION = 10;
const SECTION_PRIORITY = {
  Today: ["Civic", "Entertainment"],
  "This Week": ["Live Music", "Entertainment"],
};
```

**Step 2: Add sort helpers**

Insert after `groupEventsByDate` (line ~289):

```js
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
```

**Step 3: Add heading + overflow renderers**

Insert before `// 7. Event Card Renderer`:

```js
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
```

**Step 4: Rework `renderDashboard()` section loop**

Replace the section loop inside `renderDashboard()` (currently lines 454-467):

```js
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
```

The rest of `renderDashboard()` (queued sources block, empty state) is unchanged.

**Step 5: Register interactions + drop the loading card in `init()`**

In `init()` (line ~492), after `initSubmitPanel();` add:

```js
  initOverflowInteractions();
```

At the very end of `init()` (after `renderCategoryTabs(); renderDashboard();`), add:

```js
  // The loading card sits outside #dashboard now; remove it once the first
  // render is complete (success or failure — the empty state speaks for itself).
  const statusMessage = document.getElementById("status-message");
  if (statusMessage) statusMessage.remove();
```

**Step 6: Syntax check**

Run: `node --check app.js` — expected: no output, exit 0.

**Step 7: Commit**

```bash
git add app.js
git commit -m "feat: cap sections at 10 with overflow drop-down; priority order Today (Civic, Entertainment) and This Week (Live Music, Entertainment)"
```

---

### Task 4: CLAUDE.md — document new dashboard behavior

**Files:**
- Modify: `CLAUDE.md` (the `app.js` bullet in the Architecture section, ~line 46)

**Step 1: Update the app.js bullet**

Find the bullet beginning `- `app.js` handles client-side rendering: date-bucketed sections...` and append after "confidence badges ... verify at source"):

```markdown
  The dashboard pins a static FEATURED hero (Quantum Prairie After Dark, an
  Eventbrite listing — hardcoded in `index.html`, not part of `events.json`)
  above the sections, caps every date section at 10 cards with the remainder
  behind a per-section overflow drop-down (`app.js` `renderOverflowMenu`), and
  sorts Today Civic→Entertainment and This Week Live Music→Entertainment first
  (`SECTION_PRIORITY`).
```

Keep the existing text intact; this is an addition to the same bullet.

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe featured hero, section caps, and priority ordering in CLAUDE.md"
```

---

### Task 5: End-to-end verification

**Step 1: Serve the site**

Run in background: `npm run serve` (starts `http://localhost:8080`). Then:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:8080 | Select-Object StatusCode
```

Expected: `200`.

**Step 2: Static HTML assertions**

Run: `curl.exe -s http://localhost:8080 | Select-String -Pattern 'featured-section','Quantum Prairie After Dark','eventbrite.com/e/quantum-prairie-after-dark-tickets-1998799157085'` — expect matches.

**Step 3: Rendered DOM assertions (headless Edge)**

Locate Edge, then dump the JS-rendered DOM and assert the dashboard built correctly:

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
& $edge --headless=new --disable-gpu --dump-dom "http://localhost:8080" 2>$null | Out-File -Encoding utf8 rendered-dom.html
```

Then assert in `rendered-dom.html`:
- contains `featured-section` and `Quantum Prairie After Dark`
- contains 4+ `date-group-heading` (Today/Tomorrow/This Week/Later have events)
- contains 3+ `overflow-trigger` (Today=54→44 hidden, This Week=63→53, Later=351→341)
- contains `44 more today events` (exact overflow label for Today)
- does NOT contain `No events found`
- the first rendered card after the Today heading is a Civic event (`Garden After Hours` / `Yorkville Hometown Days` — Civic sorts before everything else today) — spot-check the order textually: find `>Today<` then the next `event-title` should be a Civic entry
- `status-message` no longer exists in the DOM

**Step 4: Visual screenshots**

```powershell
& $edge --headless=new --disable-gpu --screenshot="D:\Event_Calendar\verify-dark.png" --window-size=1440,5000 "http://localhost:8080"
```

(If the screenshot comes out in light theme, retry with `--force-prefers-color-scheme=dark`; the CSS is var-driven, so one theme visually verified + code review of the other is acceptable.) Also capture a narrow viewport: `--window-size=390,2600`. Review the PNGs for: hero on top with badges/CTA, count chips on headings, 10 cards max per visible section, trigger rows with chevrons, and no layout breakage. **Manually click-through is not possible headlessly — open one overflow trigger via the dump-dom flow is enough; interaction logic is exercised in Step 5.**

**Step 5: Interaction smoke test (dropdown open/close)**

The delegated click logic can be smoke-tested by temporarily running a tiny DOM-less check is not possible; instead use headless Edge with `--virtual-time-budget=3000 --dump-dom` after injecting a click via the DevTools protocol is out of scope. Practical substitute: code-review the single delegated handler (Task 3 Step 3) for: toggle on trigger click, close-all on outside click, Escape closes, `aria-expanded` sync, `hidden` attribute sync. If Edge supports it, optionally run:

```powershell
& $edge --headless=new --disable-gpu --virtual-time-budget=2000 --dump-dom "javascript:(()=>{})()" 
```

(no-op; skip if unsupported — Step 3 DOM + code review is the acceptance gate).

**Step 6: Data integrity**

Run: `git status --short` — expected: no modifications to `data/events.json` or `scripts/`. Any unexpected change means a regression; revert it.

**Step 7: Final review & fix pass**

Re-read the final `app.js` `renderDashboard`, `renderOverflowMenu`, and `init` sections against the plan; fix any discrepancy found, re-run Steps 1-3, and commit fixes as a separate commit if needed.

---

## Definition of done

- FEATURED hero (Quantum Prairie After Dark → Eventbrite) is static markup in `index.html`, always visible above all views.
- Each date section renders ≤ 10 cards, then a single trigger opens a styled drop-down listing the remainder (rows = links, new tab), closes on outside click/Escape, `aria-expanded` correct.
- Today sorts Civic → Entertainment → time; This Week sorts Live Music → Entertainment → time; caps and sorting hold under category tabs and search.
- Loading card removed after first render; empty state still shows for no results.
- `data/events.json`, `scripts/`, and the pipeline are byte-identical (`git status` clean apart from the intended files).
- All changes committed on `main` with the messages listed above.
