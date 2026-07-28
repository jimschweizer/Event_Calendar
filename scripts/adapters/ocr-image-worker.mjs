// Runs as an isolated child process (spawned by ocr-image.mjs). tesseract.js
// has known failure modes (corrupt/unsupported images) that throw asynchronously
// past any try/catch and kill the Node process outright — running it here means
// that crash only takes down this worker, not the whole fetch-events run.
import * as cheerio from "cheerio";
import { createWorker } from "tesseract.js";
import { USER_AGENT, FETCH_TIMEOUT_MS } from "../lib/normalize.mjs";

const DEFAULT_MAX_IMAGES = 5;
const SKIP_IMAGE_PATTERN = /logo|icon|avatar|favicon|sprite|\.svg(\?|$)/i;
const MIN_IMAGE_DIMENSION = 150;

const MONTHS =
  "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)";
const DATE_PATTERN = new RegExp(`${MONTHS}\\.?\\s+\\d{1,2}(st|nd|rd|th)?,?\\s*(20\\d{2})?`, "i");

// Wix (and similar CDNs) encode the served image size in the URL itself
// (e.g. "w_21,h_21" for a tiny icon vs "w_600,h_461" for a real flyer) —
// cheap way to skip icons/avatars without downloading them first.
function looksLikeIcon(url) {
  const match = url.match(/w_(\d+),h_(\d+)/);
  if (!match) return false;
  return Number(match[1]) < MIN_IMAGE_DIMENSION || Number(match[2]) < MIN_IMAGE_DIMENSION;
}

// PNG, JPEG, GIF, BMP magic-byte signatures — the formats tesseract.js/Jimp
// decode reliably. Anything else (WEBP, AVIF, truncated files) is skipped
// rather than risking a decoder crash.
function detectRasterFormat(buf) {
  if (buf.length < 4) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.slice(0, 3).toString("ascii") === "GIF") return "gif";
  if (buf.slice(0, 2).toString("ascii") === "BM") return "bmp";
  return null;
}

function firstLine(text) {
  return (
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)[0] || ""
  );
}

function guessDateTime(text) {
  const match = text.match(DATE_PATTERN);
  if (!match) return null;
  const cleaned = match[0].replace(/(st|nd|rd|th)/i, "");
  const d = new Date(cleaned);
  if (Number.isNaN(d.getTime())) return null;
  // OCR misreads (e.g. a garbled year) can produce a technically-valid but
  // nonsensical date; bound to a plausible window rather than show garbage.
  const year = d.getFullYear();
  const nowYear = new Date().getFullYear();
  if (year < nowYear - 1 || year > nowYear + 2) return null;
  return d.toISOString();
}

async function fetchImageBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!detectRasterFormat(buf)) throw new Error("not a supported raster image format");
  return buf;
}

async function main() {
  const source = JSON.parse(process.argv[2]);

  const res = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const imgSel = source.selectors?.image || "img";
  const imageUrls = new Set();
  $(imgSel).each((_, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (!src || SKIP_IMAGE_PATTERN.test(src) || looksLikeIcon(src)) return;
    try {
      imageUrls.add(new URL(src, source.url).toString());
    } catch {
      // skip unparseable src
    }
  });

  const candidates = Array.from(imageUrls).slice(0, source.maxImages || DEFAULT_MAX_IMAGES);
  if (candidates.length === 0) {
    return { events: [], error: "no flyer images found on calendar page" };
  }

  const worker = await createWorker("eng");
  const events = [];
  try {
    for (const imageUrl of candidates) {
      try {
        const buf = await fetchImageBuffer(imageUrl);
        const {
          data: { text },
        } = await worker.recognize(buf);
        const cleanText = text.trim();
        if (!cleanText) continue;
        events.push({
          title: firstLine(cleanText) || "Phoenix Club Event (flyer — verify details)",
          description: cleanText.slice(0, 400),
          start: guessDateTime(cleanText),
          link: source.url,
          imageUrl,
          confidence: "low",
        });
      } catch {
        // one bad/unreadable flyer shouldn't sink the rest
      }
    }
  } finally {
    await worker.terminate();
  }

  if (events.length === 0) {
    return { events: [], error: "OCR produced no readable text from flyer images" };
  }
  return { events, error: null };
}

main()
  .then((result) => {
    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  })
  .catch((err) => {
    process.stdout.write(JSON.stringify({ events: [], error: err.message || String(err) }));
    process.exit(0);
  });
