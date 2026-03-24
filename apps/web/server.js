import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST_DIR = join(__dirname, "dist");
const PORT = process.env.PORT || 5173;

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
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer((req, res) => {
  // Strip query string
  const urlPath = req.url.split("?")[0];
  let filePath = join(DIST_DIR, urlPath);

  // Resolve to index.html for SPA routing when the file doesn't exist
  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(DIST_DIR, "index.html");
  }

  const ext = extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // Cache static assets aggressively; never cache index.html
  const isIndex = filePath.endsWith("index.html");
  res.setHeader(
    "Cache-Control",
    isIndex ? "no-cache, no-store, must-revalidate" : "public, max-age=31536000, immutable"
  );
  res.setHeader("Content-Type", contentType);

  createReadStream(filePath)
    .on("error", () => {
      // Final fallback: serve index.html
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      createReadStream(join(DIST_DIR, "index.html")).pipe(res);
    })
    .pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on http://0.0.0.0:${PORT}`);
});
