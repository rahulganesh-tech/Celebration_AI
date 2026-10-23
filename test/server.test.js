/**
 * @fileoverview Automated test suite for Celebration AI.
 * Uses Node's built-in test runner (node --test) with zero external dependencies.
 * Covers all 14 evaluation requirements specified in the project scorecard.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../server/index');
const { validatePlanInput } = require('../server/validate');

describe('Celebration AI Server Test Suite (14 Tests)', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = createServer();
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  // Test 1
  it('1. GET / serves the frontend HTML', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/html'), `Expected text/html, got ${contentType}`);
    const text = await res.text();
    assert.ok(text.includes('Celebration AI'), 'HTML must contain Celebration AI');
  });

  // Test 2
  it('2. GET /app.js serves JavaScript', async () => {
    const res = await fetch(`${baseUrl}/app.js`);
    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('javascript'), `Expected javascript, got ${contentType}`);
    const text = await res.text();
    assert.ok(text.length > 50, 'JavaScript body must not be empty');
  });

  // Test 3
  it('3. GET /styles.css serves CSS', async () => {
    const res = await fetch(`${baseUrl}/styles.css`);
    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert.ok(contentType.includes('text/css'), `Expected text/css, got ${contentType}`);
    const text = await res.text();
    assert.ok(text.length > 50, 'CSS body must not be empty');
  });

  // Test 4
  it('4. GET /healthz reports ok', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
  });

  // Test 5
  it('5. GET /does-not-exist returns 404, not a crash', async () => {
    const res = await fetch(`${baseUrl}/does-not-exist-file-xyz.txt`);
    assert.equal(res.status, 404);
  });

  // Test 6
  it('6. POST /api/plan without a description returns 400', async () => {
    const res = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'wedding', budget: 500000 })
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error, 'Must return error message');
  });

  // Test 7
  it('7. POST /api/plan with invalid JSON body returns 400, not a crash', async () => {
    const res = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"description": "broken json without closing brace'
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error, 'Must report malformed JSON');
  });

  // Test 8
  it('8. POST /api/plan with a valid description never returns a blank/empty body, even without a Gemini key', async () => {
    const res = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Golden Jubilee 50th birthday for Mom with 100 guests',
        eventType: 'birthday',
        budget: 400000,
        guests: 100
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data, 'Response data must exist');
    assert.ok(data.budget && Array.isArray(data.budget.categories), 'Must include budget categories');
    assert.ok(Array.isArray(data.timeline) && data.timeline.length > 0, 'Must include timeline');
    assert.ok(Array.isArray(data.vendors) && data.vendors.length > 0, 'Must include vendor checklist');
    assert.ok(Array.isArray(data.ideas) && data.ideas.length > 0, 'Must include personalized ideas');
    assert.ok(data.source, 'Must include source tag');
  });

  // Test 9
  it('9. path traversal outside public/ is rejected, not served', async () => {
    const res = await fetch(`${baseUrl}/../package.json`);
    assert.ok(res.status === 403 || res.status === 404, `Expected 403 or 404, got ${res.status}`);
    const text = await res.text();
    assert.ok(!text.includes('"name": "celebration-ai"'), 'Must never leak server-side package.json');
  });

  // Test 10
  it('10. responses carry security headers', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.ok(res.headers.get('content-security-policy'), 'Must contain Content-Security-Policy');
    assert.ok(res.headers.get('strict-transport-security'), 'Must contain Strict-Transport-Security');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(res.headers.get('permissions-policy'), 'Must contain Permissions-Policy');
  });

  // Test 11
  it('11. an oversized /api/plan request body is rejected with 413', async () => {
    // Generate a payload larger than 10KB
    const largeText = 'A'.repeat(12 * 1024);
    const res = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: largeText })
    });
    assert.equal(res.status, 413);
  });

  // Test 12
  it('12. an unexpected HTTP method is rejected with 405, not served as a file', async () => {
    const res = await fetch(`${baseUrl}/styles.css`, {
      method: 'DELETE'
    });
    assert.equal(res.status, 405);
    const allowHeader = res.headers.get('allow');
    assert.ok(allowHeader, 'Must set Allow header');
  });

  // Test 13
  it('13. budget and guests are clamped to sane numeric bounds, never NaN or negative', async () => {
    // Direct validation logic check
    const clampedInput = validatePlanInput({
      description: 'Test celebration event',
      budget: -50000,
      guests: 'not-a-number'
    });
    assert.ok(clampedInput.valid);
    assert.ok(clampedInput.data.budget >= 10000, 'Budget must be clamped to minimum threshold');
    assert.ok(clampedInput.data.guests >= 5, 'Guests must be clamped to positive bound');
    assert.ok(!Number.isNaN(clampedInput.data.budget), 'Budget must never be NaN');
    assert.ok(!Number.isNaN(clampedInput.data.guests), 'Guests must never be NaN');

    // Endpoint end-to-end check
    const res = await fetch(`${baseUrl}/api/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Wedding celebration',
        budget: -99999,
        guests: -50
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.budget.total > 0, 'Total budget in response must be positive');
  });

  // Test 14
  it('14. static assets are served gzip-compressed when the client accepts it', async () => {
    const res = await fetch(`${baseUrl}/styles.css`, {
      headers: { 'Accept-Encoding': 'gzip' }
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-encoding'), 'gzip');
    assert.ok(res.headers.get('vary')?.includes('Accept-Encoding'));
  });
});
