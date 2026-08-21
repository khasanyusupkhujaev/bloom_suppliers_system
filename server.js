import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./lib/platform.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const port = Number(process.env.PORT || 4173);

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const safePath = normalize(join(publicDir, requested));
  if (!safePath.startsWith(publicDir)) return sendJson(res, 403, { error: "Forbidden" });
  if (!existsSync(safePath)) return sendJson(res, 404, { error: "Not found" });
  const type =
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".svg": "image/svg+xml",
    }[extname(safePath)] || "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  createReadStream(safePath).pipe(res);
}

createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res);
  return serveStatic(req, res, url);
}).listen(port, () => {
  console.log(`BLOOM Supplier Portal running on http://127.0.0.1:${port}`);
});
