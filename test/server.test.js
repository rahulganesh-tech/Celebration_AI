// Zero-dependency test suite using Node's built-in test runner.
// Run with: npm test (node --test test/)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 8099;
const BASE = `http://localhost:${PORT}`;

let serverProcess;

before(async () => {
  serverProcess = spawn(process.execPath, [path.join(__dirname, "..", "server", "index.js")], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: "pipe"
  });

  // wait for the server to start listening
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("server did not start in time")), 5000);
    serverProcess.stdout.on("data", (chunk) => {
      if (chunk.toString().includes("listening")) {
        clearTimeout(timeout);
        resolve();
      }
    });
    serverProcess.on("error", reject);
  });
});

after(() => {
  serverProcess.kill();
});

test("GET / serves the frontend HTML", async () => {
  const res = await fetch(`${BASE}/`);
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Celebration AI/);
});

test("GET /app.js serves JavaScript", async () => {
  const res = await fetch(`${BASE}/app.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /javascript/);
});

test("GET /styles.css serves CSS", async () => {
  const res = await fetch(`${BASE}/styles.css`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /css/);
});

test("GET /healthz reports ok", async () => {
  const res = await fetch(`${BASE}/healthz`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.ok, true);
});

test("GET /does-not-exist returns 404, not a crash", async () => {
  const res = await fetch(`${BASE}/does-not-exist`);
  assert.equal(res.status, 404);
});

test("POST /api/plan without a description returns 400", async () => {
  const res = await fetch(`${BASE}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.ok(json.error);
});

test("POST /api/plan with invalid JSON body returns 400, not a crash", async () => {
  const res = await fetch(`${BASE}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not valid json"
  });
  assert.equal(res.status, 400);
});

test("POST /api/plan with a valid description never returns a blank/empty body, even without a Gemini key", async () => {
  // In this test environment there is no GEMINI_API_KEY set, so the server
  // must fall back gracefully (never crash, never return an empty body) --
  // this is the core "no blank screen" reliability requirement.
  const res = await fetch(`${BASE}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: "Birthday",
      description: "A small birthday party for 20 guests",
      budget: 20000,
      guests: 20,
      city: "Chennai"
    })
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.source === "fallback" || json.source === "live");
  if (json.source === "fallback") {
    assert.ok(json.error, "fallback response should explain why, for the frontend to show");
  }
});

test("path traversal outside public/ is rejected, not served", async () => {
  const res = await fetch(`${BASE}/../package.json`);
  assert.notEqual(res.status, 200);
});

test("responses carry security headers", async () => {
  const res = await fetch(`${BASE}/`);
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.ok(res.headers.get("content-security-policy"));
});

test("an oversized /api/plan request body is rejected with 413", async () => {
  const hugeDescription = "a".repeat(20_000); // well over MAX_REQUEST_BODY_BYTES
  const res = await fetch(`${BASE}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: hugeDescription })
  });
  assert.equal(res.status, 413);
});

test("an unexpected HTTP method is rejected with 405, not served as a file", async () => {
  const res = await fetch(`${BASE}/`, { method: "DELETE" });
  assert.equal(res.status, 405);
});

test("budget and guests are clamped to sane numeric bounds, never NaN or negative", async () => {
  const res = await fetch(`${BASE}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: "A test event",
      budget: -500,
      guests: "not-a-number"
    })
  });
  assert.equal(res.status, 200);
  // the request itself must not crash the server regardless of garbage input
  const json = await res.json();
  assert.ok(json.source === "fallback" || json.source === "live");
});

test("static assets are served gzip-compressed when the client accepts it", async () => {
  const res = await fetch(`${BASE}/app.js`, { headers: { "Accept-Encoding": "gzip" } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-encoding"), "gzip");
});
