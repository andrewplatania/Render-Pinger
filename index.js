const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;
const INTERVAL_MS = parseInt(process.env.PING_INTERVAL_MS || "10") * 60 * 1000;
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

const EXTRA_URLS = process.env.PING_URLS
  ? process.env.PING_URLS.split(",").map((u) => u.trim()).filter(Boolean)
  : [];

const URLS = [SELF_URL, ...EXTRA_URLS];

function ping(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = url.startsWith("https") ? https : http;

    const req = client.get(url, { timeout: 10000 }, (res) => {
      const ms = Date.now() - start;
      console.log(`[${timestamp()}] OK ${url} ${res.statusCode} (${ms}ms)`);
      res.resume();
      resolve({ url, status: res.statusCode, ms, ok: true });
    });

    req.on("timeout", () => {
      req.destroy();
      console.log(`[${timestamp()}] TIMEOUT ${url}`);
      resolve({ url, status: null, ms: null, ok: false, error: "timeout" });
    });

    req.on("error", (err) => {
      console.log(`[${timestamp()}] ERR ${url} ${err.message}`);
      resolve({ url, status: null, ms: null, ok: false, error: err.message });
    });
  });
}

async function pingAll() {
  console.log(`\n[${timestamp()}] Pinging ${URLS.length} URL(s)...`);
  const results = await Promise.all(URLS.map(ping));
  const ok = results.filter((r) => r.ok).length;
  console.log(`[${timestamp()}] Done ${ok}/${results.length} healthy\n`);
  return results;
}

function timestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

let lastResults = [];
let lastPingTime = null;

const server = http.createServer((req, res) => {
  if (req.url === "/ping" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(`<!DOCTYPE html>
<html>
<head>
  <title>Pinger Status</title>
  <meta http-equiv="refresh" content="30">
  <style>
    body { font-family: monospace; background: #111; color: #eee; padding: 2rem; }
    h1 { color: #7ef7a0; margin: 0 0 0.25rem; }
    .sub { color: #666; margin-bottom: 2rem; font-size: 0.85rem; }
    table { border-collapse: collapse; width: 100%; }
    th { text-align: left; color: #888; border-bottom: 1px solid #333; padding: 0.4rem 1rem 0.4rem 0; }
    td { padding: 0.5rem 1rem 0.5rem 0; border-bottom: 1px solid #1e1e1e; }
    .ok { color: #7ef7a0; } .err { color: #f77e7e; }
    .foot { color: #888; font-size: 0.85rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>Pinger</h1>
  <div class="sub">Last ping: ${lastPingTime || "none"} | Interval: ${INTERVAL_MS / 60000} min | Auto-refresh: 30s</div>
  <table>
    <tr><th>URL</th><th>Status</th><th>Latency</th></tr>
    ${lastResults.length
      ? lastResults.map((r) => `
    <tr>
      <td>${r.url}</td>
      <td class="${r.ok ? "ok" : "err"}">${r.ok ? r.status : r.error || "err"}</td>
      <td>${r.ms != null ? r.ms + "ms" : "n/a"}</td>
    </tr>`).join("")
      : `<tr><td colspan="3" style="color:#666">Waiting for first ping...</td></tr>`
    }
  </table>
  <div class="foot">Watching ${URLS.length} URL(s). Page auto-refreshes every 30s.</div>
</body>
</html>`);
});

server.listen(PORT, () => {
  console.log(`[${timestamp()}] Running on port ${PORT}`);
  console.log(`[${timestamp()}] Interval: ${INTERVAL_MS / 60000} min`);
  URLS.forEach((u) => console.log(`   ${u}`));
  console.log();
});

(async () => {
  lastResults = await pingAll();
  lastPingTime = timestamp();

  setInterval(async () => {
    lastResults = await pingAll();
    lastPingTime = timestamp();
  }, INTERVAL_MS);
})();
