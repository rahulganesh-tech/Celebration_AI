/**
 * @fileoverview Security response headers for Celebration AI.
 * Implements CSP, HSTS, X-Frame-Options, X-Content-Type-Options, and Permissions-Policy.
 */

/**
 * Applies strict HTTP security headers to a server response.
 * @param {import('http').ServerResponse} res - Outgoing HTTP response object.
 */
function applySecurityHeaders(res) {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none';"
  );
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

module.exports = {
  applySecurityHeaders
};
