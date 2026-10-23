// Celebration AI — minimal Node server (no external dependencies).
// Serves the static frontend and exposes POST /api/plan, which calls the
// Gemini API server-side only. Falls back to a sample plan on any failure
// so the UI never shows a blank screen or a raw error.
//
// Module layout:
// config.js shared constants / env
// securityHeaders.js response security headers (CSP, HSTS, etc.)
// validate.js input validation + sanitization for /api/plan
// gemini.js prompt building + the Gemini API call
// staticFiles.js static file serving (gzip, caching, path-traversal guard)

import http from "node:http";
import { PORT, GEMINI_API_KEY, MAX_REQUEST_BODY_BYTES } from "./config.js";
import { applySecurityHeaders } from "./securityHeaders.js";
import { validatePlanRequest } from "./validate.js";
import { callGemini } from "./gemini.js";
import { serveStatic } from "./staticFiles.js";

/**
 * Writes a JSON response with the standard security headers applied.
 * @param {import('http').ServerResponse} res
 * @param {number} status - HTTP status code.
 * @param {object} obj - Serialized as the response body.
 */
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  applySecurityHeaders(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

/**
 * Handles POST /api/plan end-to-end: streams and size-limits the request
 * body, parses and validates it, calls Gemini, and always responds with a
 * usable plan — either a live one or the graceful fallback — never a raw
 * error or an unhandled rejection.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
function handleApiPlan(req, res) {
  let body = "";
  let tooLarge = false;

  req.on("data", (chunk) => {
    if (tooLarge) return;
    body += chunk;
    if (body.length > MAX_REQUEST_BODY_BYTES) {
      tooLarge = true;
      // Respond before tearing down the connection, so the client actually
      // receives the 413 instead of seeing a reset connection.
      sendJSON(res, 413, { error: "Request too large." });
      req.destroy();
    }
  });

  req.on("end", async () => {
    if (tooLarge) {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(body || "{}");
    } catch {
      sendJSON(res, 400, { error: "Invalid request body." });
      return;
    }

    const validated = validatePlanRequest(payload);
    if (!validated.ok) {
      sendJSON(res, 400, { error: validated.error });
      return;
    }

    try {
      const plan = await callGemini(validated.data);
      sendJSON(res, 200, { plan, source: "live" });
    } catch (err) {
      // Never surface a raw error or blank screen to the user — the
      // frontend has its own sample-plan fallback for this case.
      console.error("[/api/plan] falling back:", err.message);
      sendJSON(res, 200, {
        error: "AI generation unavailable right now, showing a sample plan instead.",
        source: "fallback"
      });
    }
  });

  req.on("error", () => {
    // Client disconnected mid-upload; nothing to respond to.
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/plan") {
    handleApiPlan(req, res);
    return;
  }
  if (req.method === "GET" && req.url === "/healthz") {
    sendJSON(res, 200, { ok: true });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJSON(res, 405, { error: "Method not allowed." });
    return;
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Celebration AI listening on port ${PORT} (Gemini key ${GEMINI_API_KEY ? "present" : "MISSING — fallback mode"})`);
});

export default server;
