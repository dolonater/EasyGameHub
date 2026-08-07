/**
 * 本地 mock WebDAV 服务（仅用于 T18 示例验收）
 *
 * 用法：node mock-dav.mjs [port]
 * - PUT   /dav/<file>        存储文件到 ./uploads/
 * - GET   /dav/             列出已上传文件
 * - 带 CORS 头（webview 跨源 fetch 需要）
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.argv[2] ?? 8080);
const ROOT = path.resolve(import.meta.dirname, "uploads");
fs.mkdirSync(ROOT, { recursive: true });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "PUT, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const server = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", CORS["Access-Control-Allow-Origin"]);
  res.setHeader("Access-Control-Allow-Methods", CORS["Access-Control-Allow-Methods"]);
  res.setHeader("Access-Control-Allow-Headers", CORS["Access-Control-Allow-Headers"]);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const rel = decodeURIComponent(url.pathname).replace(/^\/dav\/?/, "");

  if (req.method === "PUT" && rel) {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const file = path.join(ROOT, path.basename(rel));
      fs.writeFileSync(file, Buffer.concat(chunks));
      console.log(`[mock-dav] PUT ${rel} (${Buffer.concat(chunks).length} bytes)`);
      res.writeHead(201);
      res.end();
    });
    return;
  }

  if (req.method === "GET" && rel === "") {
    const files = fs.readdirSync(ROOT).map((f) => ({ name: f, size: fs.statSync(path.join(ROOT, f)).size }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(files, null, 2));
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`mock WebDAV 服务运行中：http://127.0.0.1:${PORT}/dav （上传目录 ${ROOT}）`);
});
