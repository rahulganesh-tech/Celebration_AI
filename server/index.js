/**
 * @fileoverview Main HTTP server entry point for Celebration AI.
 * Implements routing, 10KB request size limits, security headers, and method verification.
 * Zero external dependencies (uses Node.js built-in http module).
 */

const http = require('http');
const { PORT, MAX_BODY_BYTES } = require('./config');
const { applySecurityHeaders } = require('./securityHeaders');
const { validatePlanInput } = require('./validate');
const { generatePlan } = require('./gemini');
const { serveStaticFile } = require('./staticFiles');

/**
 * Handles incoming HTTP requests.
 * @param {import('http').IncomingMessage} req - Inbound request.
 * @param {import('http').ServerResponse} res - Outbound response.
 */
function handleRequest(req, res) {
  // Always apply security headers to every response
  applySecurityHeaders(res);

  const method = req.method ? req.method.toUpperCase() : 'GET';

  // Reject unexpected HTTP methods with 405 Method Not Allowed
  if (method !== 'GET' && method !== 'POST' && method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST, HEAD');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: `Method ${method} Not Allowed` }));
    return;
  }

  // Parse request URL
  let parsedUrl;
  try {
    parsedUrl = new URL(req.url || '/', 'http://localhost');
  } catch (_) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Bad Request');
    return;
  }

  const pathname = parsedUrl.pathname;

  // Endpoint: Health check
  if (method === 'GET' && (pathname === '/healthz' || pathname === '/api/health')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Endpoint: Generate Event Plan (POST /api/plan)
  if (pathname === '/api/plan') {
    if (method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Allow', 'POST');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Method Not Allowed' }));
      return;
    }

    // Early rejection if Content-Length header exceeds MAX_BODY_BYTES (10KB)
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      res.statusCode = 413;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Payload Too Large: 10KB body limit exceeded' }));
      return;
    }

    let bytesReceived = 0;
    const bodyChunks = [];
    let isOversized = false;

    req.on('data', (chunk) => {
      bytesReceived += chunk.length;
      if (bytesReceived > MAX_BODY_BYTES) {
        isOversized = true;
        req.destroy();
        if (!res.headersSent) {
          res.statusCode = 413;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'Payload Too Large: 10KB body limit exceeded' }));
        }
        return;
      }
      bodyChunks.push(chunk);
    });

    req.on('end', async () => {
      if (isOversized || res.headersSent) return;

      const rawBody = Buffer.concat(bodyChunks).toString('utf8');
      let payload;

      try {
        payload = JSON.parse(rawBody || '{}');
      } catch (err) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: 'Malformed JSON in request body' }));
        return;
      }

      // Input validation and bounds clamping
      const validation = validatePlanInput(payload);
      if (!validation.valid) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: validation.error }));
        return;
      }

      try {
        const plan = await generatePlan(validation.data);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(plan));
      } catch (err) {
        // Safe exception containment — never leak internal stack traces
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ...require('./gemini').getFallbackPlan(validation.data), source: 'fallback' }));
      }
    });

    req.on('error', (err) => {
      if (!res.headersSent) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message || 'Request stream error' }));
      }
    });

    return;
  }

  // Handle all other GET / HEAD requests as static files
  if (method === 'GET' || method === 'HEAD') {
    serveStaticFile(req, res, pathname);
    return;
  }

  // Fallback 404
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('404 Not Found');
}

/**
 * Creates and returns the HTTP server instance.
 * @returns {import('http').Server}
 */
function createServer() {
  return http.createServer(handleRequest);
}

// Start server when executed directly
if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`[Celebration AI] Production server listening on port ${PORT}`);
  });
}

module.exports = {
  handleRequest,
  createServer
};
