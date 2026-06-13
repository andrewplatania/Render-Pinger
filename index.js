const http = require("http");
const https = require("https");

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const INTERVAL_MS = parseInt(process.env.PING_INTERVAL_MS || "10") * 60 * 1000; // default 10 min

// Add your URLs here (or set via PING_URLS env var as comma-separated)
const DEFAULT_URLS = [
  "https://your-service-1.onrender.com",
  "https://your-service-2.onrender.com",
];

const URLS = process.env.PING_URLS
  ? process.env.PING_URLS.split(",").map((u) => u.trim()).filter(Boolean)
  : DEFAULT_URLS;

// ─── PINGER ───────────────────────────────────────────────────────────────────
function ping(url) {
  return new Promise((resolve) => {
    const start = Date.now();
    const client = url.startsWith("https") ? https : http;

    const req = client.get(url, { timeout: 10000 }, (res) => {
      const ms = Date.now() - start;
      console.log(`[${timestamp()}] ✅ ${url} → ${res.statusCode} (${ms}ms)`);
      res.resume(); // drain response
      resolve({ url, status: res.statusCode, ms, ok: true });
    });

    req.on("timeout", () => {
      req.destroy();
      console.log(`[${timestamp()}] ⏱  ${url} → TIMEOUT`);
      resolve({ url, status: null, ms: null, ok: false, error: "timeout" });
    });

    req.on("error", (err) => {
      console.log(`[${timestamp()}] ❌ ${url} → ${err.message}`);
      resolve({ url, status: null, ms: null, ok: false, error: err.message });
    });
  });
}

async function pingAll() {
  console.log(`\n[${timestamp()}] 🔄 Pinging ${URLS.length} URL(s)...`);
  const results = await Promise.all(URLS.map(ping));
  const ok = results.filter((r) => r.ok).length;
  console.log(`[${timestamp()}] Done — ${ok}/${results.length} healthy\n`);
  return results;
}

function timestamp() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ─── HTTP SERVER (keeps Render happy + status page) ───────────────────────────
let lastResults = [];
let lastPingTime = null;

const server = http.createServer((req, res) => {
  if (req.url === "/ping" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }

  // Status page
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
    .next { color: #888; font-size: 0.85rem; margin-top: 2rem; }
  </style>
</head>
<body>
  <h1>🟢 Pinger</h1>
  <div class="sub">Last ping: ${lastPingTime || "—"} &nbsp;|&nbsp; Interval: ${INTERVAL_MS / 60000} min &nbsp;|&nbsp; Auto-refresh: 30s</div>
  <table>
    <tr><th>URL</th><th>Status</th><th>Latency</th></tr>
    ${lastResults.length
      ? lastResults.map((r) => `
    <tr>
      <td>${r.url}</td>
      <td class="${r.ok ? "ok" : "err"}">${r.ok ? r.status : "❌ " + (r.error || "err")}</td>
      <td>${r.ms != null ? r.ms + "ms" : "—"}</td>
    </tr>`).join("")
      : `<tr><td colspan="3" style="color:#666">No pings yet — first ping runs at startup</td></tr>`
    }
  </table>
  <div class="next">Watching ${URLS.length} URL(s). Page auto-refreshes every 30s.</div>
</body>
</html>`);
});

server.listen(PORT, () => {
  console.log(`[${timestamp()}] 🚀 Pinger running on port ${PORT}`);
  console.log(`[${timestamp()}] 📋 Watching ${URLS.length} URL(s):`);
  URLS.forEach((u) => console.log(`   • ${u}`));
  console.log(`[${timestamp()}] ⏰ Interval: ${INTERVAL_MS / 60000} min\n`);
});

// ─── SCHEDULE ─────────────────────────────────────────────────────────────────
(async () => {
  // Ping immediately on startup
  lastResults = await pingAll();
  lastPingTime = timestamp();

  setInterval(async () => {
    lastResults = await pingAll();
    lastPingTime = timestamp();
  }, INTERVAL_MS);
})();
