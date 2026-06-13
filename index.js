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
  return new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace(",", "");
}

let lastResults = [];
let lastPingTime = null;

const server = http.createServer((req, res) => {
  if (req.url === "/ping" || req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  const allOk = lastResults.length > 0 && lastResults.every((r) => r.ok);
  const anyErr = lastResults.some((r) => !r.ok);
  res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="30">
  <title>Pinger</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0d0d0d;
      --surface: #161616;
      --border: rgba(255,255,255,0.07);
      --text: #e8e8e8;
      --muted: #666;
      --green: #22c55e;
      --green-dim: rgba(34,197,94,0.12);
      --red: #f87171;
      --red-dim: rgba(248,113,113,0.12);
      --yellow: #fbbf24;
    }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; min-height: 100vh; padding: 2.5rem 2rem; }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 2rem; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .dot.ok { background: var(--green); box-shadow: 0 0 8px var(--green); }
    .dot.err { background: var(--red); box-shadow: 0 0 8px var(--red); }
    .dot.idle { background: var(--yellow); }
    h1 { font-size: 18px; font-weight: 600; letter-spacing: -0.3px; }
    .meta { font-size: 12px; color: var(--muted); margin-left: auto; text-align: right; line-height: 1.6; }
    .cards { display: flex; flex-direction: column; gap: 8px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px 18px; display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 16px; transition: border-color 0.2s; }
    .card:hover { border-color: rgba(255,255,255,0.14); }
    .card.ok { border-left: 3px solid var(--green); }
    .card.err { border-left: 3px solid var(--red); }
    .url { font-family: "SF Mono", "Fira Code", monospace; font-size: 12.5px; color: var(--text); word-break: break-all; }
    .badge { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; white-space: nowrap; }
    .badge.ok { background: var(--green-dim); color: var(--green); }
    .badge.err { background: var(--red-dim); color: var(--red); }
    .latency { font-size: 12px; color: var(--muted); white-space: nowrap; min-width: 48px; text-align: right; }
    .empty { color: var(--muted); padding: 2rem 0; text-align: center; }
    .footer { margin-top: 2rem; font-size: 12px; color: var(--muted); }
  </style>
</head>
<body>
  <div class="header">
    <div class="dot ${lastResults.length === 0 ? "idle" : allOk ? "ok" : "err"}"></div>
    <h1>Pinger</h1>
    <div class="meta">
      Last ping: ${lastPingTime || "waiting..."}<br>
      Refreshes every 30s
    </div>
  </div>
  <div class="cards">
    ${lastResults.length
      ? lastResults.map((r) => `
    <div class="card ${r.ok ? "ok" : "err"}">
      <div class="url">${r.url}</div>
      <div class="badge ${r.ok ? "ok" : "err"}">${r.ok ? r.status : r.error || "error"}</div>
      <div class="latency">${r.ms != null ? r.ms + "ms" : "--"}</div>
    </div>`).join("")
      : `<div class="empty">Waiting for first ping...</div>`
    }
  </div>
  <div class="footer">Watching ${URLS.length} service${URLS.length !== 1 ? "s" : ""} every ${INTERVAL_MS / 60000} min</div>
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
