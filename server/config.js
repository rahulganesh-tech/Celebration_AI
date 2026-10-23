// Shared configuration and constants for the Celebration AI server.
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const PUBLIC_DIR = path.join(__dirname, "..", "public");
export const PORT = Number(process.env.PORT) || 8080;
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

// Reliability / security limits
export const MAX_REQUEST_BODY_BYTES = 10 * 1024; // /api/plan requests are small JSON — 10KB is generous
export const GEMINI_TIMEOUT_MS = 15_000;
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MAX_FREEFORM_LENGTH = 200; // city, eventType
export const MAX_BUDGET = 100_000_000; // ₹10 crore ceiling — rejects garbage/overflow input
export const MAX_GUESTS = 100_000;

// Gemini call tuning
export const GEMINI_TEMPERATURE = 0.8;
export const GEMINI_ERROR_SNIPPET_LENGTH = 200; // chars of an error body to log, never more

export const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

// Static assets are content-hashed by nothing (plain filenames), so keep the
// cache window short — long enough to help repeat views, short enough that
// a redeploy is picked up quickly.
export const STATIC_CACHE_CONTROL = "public, max-age=300";
