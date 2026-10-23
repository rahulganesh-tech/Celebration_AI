/**
 * @fileoverview Static file server with gzip compression, caching headers, and strict path-traversal guard.
 * Zero external dependencies (uses Node.js built-in http, fs, path, and zlib).
 */

const path = require('path');
const fs = require('fs');
const zlib = require('zlib');
const { PUBLIC_DIR } = require('./config');

/**
 * MIME type mapping for static files.
 */
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

/**
 * Determines content type from file extension.
 * @param {string} filePath - Absolute file path.
 * @returns {string} MIME type string.
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Serves a static file from public directory with path-traversal prevention,
 * gzip compression, and short-lived caching headers.
 * @param {import('http').IncomingMessage} req - Inbound HTTP request.
 * @param {import('http').ServerResponse} res - Outbound HTTP response.
 * @param {string} requestPath - Normalized URL pathname.
 */
function serveStaticFile(req, res, requestPath) {
  // Normalize root to index.html
  const cleanPath = requestPath === '/' || requestPath === '' ? '/index.html' : requestPath;

  // Strict path-traversal check: resolve path and ensure it remains strictly inside PUBLIC_DIR
  const resolvedPath = path.resolve(PUBLIC_DIR, '.' + cleanPath);
  const normalizedPublic = path.normalize(PUBLIC_DIR);

  if (!resolvedPath.startsWith(normalizedPublic + path.sep) && resolvedPath !== normalizedPublic) {
    res.statusCode = 403;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Access Denied: Path traversal is not permitted.');
    return;
  }

  // Check file existence
  if (!fs.existsSync(resolvedPath)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('404 Not Found');
    return;
  }

  const stat = fs.statSync(resolvedPath);
  if (stat.isDirectory()) {
    // If directory, try index.html inside it
    const indexInDir = path.join(resolvedPath, 'index.html');
    if (fs.existsSync(indexInDir)) {
      return serveStaticFile(req, res, path.join(cleanPath, 'index.html'));
    }
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('404 Not Found');
    return;
  }

  const contentType = getContentType(resolvedPath);
  res.setHeader('Content-Type', contentType);

  // Cache-Control headers: short-lived caching for static assets, no-cache for HTML
  if (resolvedPath.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-cache');
  } else {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }

  const rawContent = fs.readFileSync(resolvedPath);
  const acceptEncoding = req.headers['accept-encoding'] || '';

  // Gzip compression if client accepts it
  if (acceptEncoding.includes('gzip')) {
    try {
      const compressed = zlib.gzipSync(rawContent);
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.setHeader('Content-Length', compressed.length);
      res.statusCode = 200;
      res.end(compressed);
      return;
    } catch (_) {
      // Fallback to uncompressed on gzip error
    }
  }

  res.setHeader('Content-Length', rawContent.length);
  res.statusCode = 200;
  res.end(rawContent);
}

module.exports = {
  getContentType,
  serveStaticFile
};
