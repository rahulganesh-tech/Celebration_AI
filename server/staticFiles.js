import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { MIME, PUBLIC_DIR, STATIC_CACHE_CONTROL } from "./config.js";
import { applySecurityHeaders } from "./securityHeaders.js";

const COMPRESSIBLE = new Set([".html", ".js", ".css", ".json", ".svg"]);

/**
 * Serves a file from public/, with gzip compression for text assets when
 * the client supports it, short-lived caching, and a hard guard against
 * path traversal outside PUBLIC_DIR.
 */
export function serveStatic(req, res) {
  let reqPath = req.url.split("?")[0];
  if (reqPath === "/") reqPath = "/index.html";

  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));

  // Path traversal guard: resolved path must stay inside PUBLIC_DIR.
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== PUBLIC_DIR) {
    applySecurityHeaders(res);
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    applySecurityHeaders(res);
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME[ext] || "application/octet-stream";
    const headers = {
      "Content-Type": contentType,
      "Cache-Control": STATIC_CACHE_CONTROL
    };

    const acceptsGzip = (req.headers["accept-encoding"] || "").includes("gzip");
    if (acceptsGzip && COMPRESSIBLE.has(ext)) {
      zlib.gzip(data, (gzipErr, compressed) => {
        if (gzipErr) {
          res.writeHead(200, headers);
          res.end(data);
          return;
        }
        headers["Content-Encoding"] = "gzip";
        headers["Vary"] = "Accept-Encoding";
        res.writeHead(200, headers);
        res.end(compressed);
      });
      return;
    }

    res.writeHead(200, headers);
    res.end(data);
  });
}
