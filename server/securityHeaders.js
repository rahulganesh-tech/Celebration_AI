/**
 * Applies the standard security header set to every response: CSP, HSTS,
 * X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and
 * Permissions-Policy. Kept as a single explicit function (rather than a
 * third-party middleware) so every header is easy to audit at a glance.
 * @param {import('http').ServerResponse} res
 */
export function applySecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
  // Cloud Run terminates TLS in front of this process; this header still
  // tells browsers to prefer HTTPS on repeat visits.
  res.setHeader("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  res.setHeader(
    "Content-Security-Policy",
    // style-src needs 'unsafe-inline' because the budget bars set their
    // width via element.style in JS (CSSOM), which CSP treats as inline
    // style; script-src deliberately has no such exception.
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; " +
      "form-action 'none'; object-src 'none'"
  );
}
