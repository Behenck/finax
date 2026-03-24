import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "dist");
const PORT = process.env.PORT || 5173;
const HOST = "0.0.0.0";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

/**
 * Returns true when the request path looks like a Vite-hashed asset.
 * Vite names assets like: chunk-AbCd1234.js, index-Xy9z.css, logo-Abc123.png
 * i.e. the filename contains a dash followed by 8+ hex characters before the extension.
 */
function isImmutableAsset(urlPath) {
  const basename = path.basename(urlPath);
  return /[.-][0-9a-fA-F]{8,}\.[^.]+$/.test(basename);
}

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const isIndexHtml = path.basename(filePath) === "index.html";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
      return;
    }

    const headers = { "Content-Type": contentType };

    if (isIndexHtml) {
      // Never cache index.html so the SPA always gets the latest shell
      headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
      headers["Pragma"] = "no-cache";
      headers["Expires"] = "0";
    } else if (isImmutableAsset(filePath)) {
      // Vite-hashed assets are content-addressed — safe to cache forever
      headers["Cache-Control"] = "public, max-age=31536000, immutable";
    } else {
      // Other static assets (favicon, robots.txt, etc.) — short cache
      headers["Cache-Control"] = "public, max-age=3600";
    }

    res.writeHead(200, headers);
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  // Strip query string and decode URI
  let urlPath;
  try {
    urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad Request");
    return;
  }

  // Prevent path traversal
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(DIST_DIR, safePath);

  // Ensure the resolved path stays inside DIST_DIR
  if (!filePath.startsWith(DIST_DIR + path.sep) && filePath !== DIST_DIR) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isFile()) {
      // Exact file match — serve it directly
      serveFile(filePath, res);
    } else if (!err && stat.isDirectory()) {
      // Directory — try index.html inside it
      const indexPath = path.join(filePath, "index.html");
      fs.stat(indexPath, (err2, stat2) => {
        if (!err2 && stat2.isFile()) {
          serveFile(indexPath, res);
        } else {
          // Fall back to SPA entry point
          serveFile(path.join(DIST_DIR, "index.html"), res);
        }
      });
    } else {
      // Unknown route — fall back to SPA entry point for client-side routing
      serveFile(path.join(DIST_DIR, "index.html"), res);
    }
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
