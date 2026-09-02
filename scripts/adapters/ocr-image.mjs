import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_PATH = path.join(__dirname, "ocr-image-worker.mjs");
const WORKER_TIMEOUT_MS = 90000;

// tesseract.js can crash the process outright on certain malformed images
// (an uncaught throw that bypasses try/catch — see ocr-image-worker.mjs).
// Running it as a child process means that crash only kills the worker;
// this adapter just sees a failed subprocess and reports it as this
// source's error, same as any other fetch failure.
//
// NOTE: OCR here is CPU-only (tesseract.js) and stays low-confidence by
// design. If flyer parsing ever needs upgrading, the dev machine has an
// NVIDIA RTX 3060 Ti (8 GB, CUDA 13.1) available for GPU OCR or a small
// vision model — see "Local Development Machine" in CLAUDE.md. The GitHub
// Actions cron has no GPU, so any GPU path must be dev-machine-only.
export async function fetchSource(source) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [WORKER_PATH, JSON.stringify(source)], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ events: [], error: `OCR worker timed out after ${WORKER_TIMEOUT_MS}ms` });
    }, WORKER_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));

    child.on("error", (err) => {
      finish({ events: [], error: `OCR worker failed to start: ${err.message}` });
    });

    child.on("close", (code) => {
      if (settled) return;
      try {
        const parsed = JSON.parse(stdout.trim());
        finish(parsed);
      } catch {
        finish({
          events: [],
          error: `OCR worker crashed (exit ${code}): ${stderr.trim().slice(0, 200) || "no output"}`,
        });
      }
    });
  });
}
