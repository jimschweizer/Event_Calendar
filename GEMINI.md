# AI-Crawler & Aggregator Compatibility Guide (GEMINI.md)

This guide documents how local businesses, civic bodies, schools, faith organizations, and clubs in the Aurora, IL area can design their web calendars to be easily recognizable and indexable by search engines, aggregators, and AI-assisted crawlers (like this calendar app).

By implementing these standards, you ensure your events automatically sync with local calendars, municipal directories, and search results without requiring developers to write complex, fragile, and high-maintenance custom scrapers.

This project and document are released under the **MIT License**.

---

## The Event Aggregation Hierarchy
To make your events accessible, implement one or more of these standards, ordered from most preferred (highest stability) to least preferred:

```
[1] Public iCal / ICS Feed (Gold Standard)  ──► 100% Reliable, zero scraping needed
[2] Schema.org JSON-LD Structured Markup    ──► Clean metadata embedded in HTML
[3] RSS / Atom Event Feeds                  ──► Simple chronological text syndication
[4] Standard HTML (Cheerio/CSS selectors)   ──► Requires custom selectors (fragile)
[5] Image-Only Flyers (Wix/Social media)    ──► Requires OCR scanning (unreliable)
```

---

## 1. The Gold Standard: Public iCal/ICS Feeds
An iCalendar (`.ics` or `.ical`) feed is a standardized text format that represents calendar events. This application reads ICS feeds with 100% confidence, zero configuration, and zero risk of visual layout breaks.

### How to implement on common platforms:
*   **Google Calendar:** If you manage your events in a public Google Calendar, go to *Calendar Settings* -> *Integrate Calendar* -> copy the **"Public address in iCal format"** (looks like `https://calendar.google.com/calendar/ical/.../public/basic.ics`).
*   **WordPress (The Events Calendar / Tribe plugin):** This plugin generates a feed automatically. Make sure the option is enabled and link to `https://yourdomain.com/events/?ical=1` or `https://yourdomain.com/events/feed/`.
*   **Finalsite (School Calendars):** Ensure the "Subscribe" feeds utility is turned on. The system will expose feeds using the URL format `/fs/calendar-manager/events.ics?calendar_ids=[IDs]`.
*   **Squarespace / Webflow:** In Squarespace, any Calendar Page can export an ICS feed. You can link to `/events?format=ical`.
*   **ChamberMaster / MemberZone:** Ensure the public sync/export features are enabled so users can copy the ICS subscribe link.

---

## 2. Structured Data: Schema.org/Event Markup
If you do not have an ICS feed, you should embed structured metadata in your HTML. Search engines (Google, Bing) and AI crawlers look for a `<script type="application/ld+json">` block in the header or body.

This block contains a machine-readable JSON representation of the event.

### Example JSON-LD Block:
Place this inside the `<head>` of your event page (or individual event listing cards):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "54th Annual Aurora Puerto Rican Heritage Festival",
  "startDate": "2026-07-26T12:00:00-05:00",
  "endDate": "2026-07-26T22:00:00-05:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "Wilder Park",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "350 N Broadway",
      "addressLocality": "Aurora",
      "addressRegion": "IL",
      "postalCode": "60505",
      "addressCountry": "US"
    }
  },
  "image": [
    "https://example.com/photos/pr-festival.jpg"
  ],
  "description": "Annual heritage celebration featuring live music, food vendors, dancing, and cultural exhibits.",
  "offers": {
    "@type": "Offer",
    "url": "https://example.com/tickets",
    "price": "0",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  },
  "organizer": {
    "@type": "Organization",
    "name": "PR Heritage Advisory Board",
    "url": "https://example.com"
  }
}
</script>
```

---

## 3. RSS and Atom Feeds
RSS feeds are simple XML streams of articles or posts. While originally meant for blogs, they work well for event syndication if the feed items contain date strings.

*   **WordPress:** Exposes a feed automatically at `/feed/` or `/events/feed/`.
*   **Discovery:** Add a autodiscovery tag in your `<head>` so crawlers can automatically detect your feed URL:
    ```html
    <link rel="alternate" type="application/rss+xml" title="Event Calendar Feed" href="/events/feed/" />
    ```

---

## 4. Design Guidelines: Common Anti-Patterns to Avoid

To make sure your events are easily indexed, avoid these design choices:

### 🚫 Anti-Pattern: Image-Only Flyers
*   **The Problem:** Posting a flyer image (JPG/PNG) containing the event details (title, dates, times, prices) without any corresponding text in the HTML body. 
*   **Why it fails:** AI crawlers have to run Optical Character Recognition (OCR) over the image. OCR is slow, resource-heavy, and highly error-prone (e.g. mistaking `6:00 PM` for `8:00 PM` or getting the location wrong).
*   **The Fix:** Always include a text description alongside the image. Make sure the text explicitly writes out the date, start time, location, and title.

### 🚫 Anti-Pattern: Dynamic JS-Only Rendering
*   **The Problem:** Using event calendar widgets (like Wix, custom scripts, or external iframe wrappers) that render the event details completely client-side in the browser.
*   **Why it fails:** Standard scrapers fetch the static page HTML and parse it instantly (using tools like `cheerio`). If the calendar is dynamically generated, the scraper will see an empty `<div>` with `0 events`.
*   **The Fix:** If using a dynamic widget, check if the plugin has a "static fallback" mode, or ensure the page outputs standard SEO metadata (JSON-LD) inside the initial server response.

### 🚫 Anti-Pattern: Over-aggressive Bot/Data-Center Blocking
*   **The Problem:** Using security firewalls (like Cloudflare, Akamai, or Wordfence) configured to block all requests originating from datacenter IP blocks (like AWS, Azure, Google Cloud, or GitHub Actions) or requests with custom user-agents.
*   **Why it fails:** Scrapers run on automated scheduler environments (like GitHub Actions runners). When they are blocked, they receive a `403 Forbidden` response and your events are omitted from the regional calendar.
*   **The Fix:** In your `robots.txt` file, explicitly allow community crawlers or whitelist specific user-agents. Alternatively, avoid locking down simple read-only calendar endpoints.
