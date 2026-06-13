const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3000;
const INTERVAL_MS = parseInt(process.env.PING_INTERVAL_MS || "10") * 60 * 1000;
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
const DASHBOARD_PASSWORD = process.env.DASHBOARD_PASSWORD || "changeme";

const EXTRA_URLS = process.env.PING_URLS
  ? process.env.PING_URLS.split(",").map((u) => u.trim()).filter(Boolean)
  : [];

let dynamicURLs = [...EXTRA_URLS];

function allURLs() {
  return [SELF_URL, ...dynamicURLs];
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
    hour12: true,
  }).replace(",", "");
}

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
  const urls = allURLs();
  console.log(`\n[${timestamp()}] Pinging ${urls.length} URL(s)...`);
  const results = await Promise.all(urls.map(ping));
  const ok = results.filter((r) => r.ok).length;
  console.log(`[${timestamp()}] Done ${ok}/${results.length} healthy\n`);
  return results;
}

let lastResults = [];
let lastPingTime = null;

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/ping" || url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("OK");
  }

  if (url === "/api/add" && req.method === "POST") {
    const body = await parseBody(req);
    if (body.password !== DASHBOARD_PASSWORD) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "wrong password" }));
    }
    let newUrl = (body.url || "").trim();
    if (!newUrl) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "no url provided" }));
    }
    if (!newUrl.startsWith("http://") && !newUrl.startsWith("https://")) {
      newUrl = "https://" + newUrl;
    }
    if (allURLs().includes(newUrl)) {
      res.writeHead(409, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "already watching that url" }));
    }
    dynamicURLs.push(newUrl);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, url: newUrl }));
  }

  if (url === "/api/remove" && req.method === "POST") {
    const body = await parseBody(req);
    if (body.password !== DASHBOARD_PASSWORD) {
      res.writeHead(401, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "wrong password" }));
    }
    const target = (body.url || "").trim();
    if (target === SELF_URL) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "cannot remove self-ping url" }));
    }
    dynamicURLs = dynamicURLs.filter((u) => u !== target);
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  const allOk = lastResults.length > 0 && lastResults.every((r) => r.ok);
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
      --surface2: #1e1e1e;
      --border: rgba(255,255,255,0.07);
      --border2: rgba(255,255,255,0.13);
      --text: #e8e8e8;
      --muted: #555;
      --green: #22c55e;
      --green-dim: rgba(34,197,94,0.1);
      --red: #f87171;
      --red-dim: rgba(248,113,113,0.1);
      --yellow: #fbbf24;
      --accent: #3b82f6;
    }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 14px; min-height: 100vh; padding: 2.5rem 2rem; max-width: 780px; margin: 0 auto; }
    .header { display: flex; align-items: center; gap: 12px; margin-bottom: 2.5rem; }
    .dot { width: 11px; height: 11px; border-radius: 50%; flex-shrink: 0; }
    .dot.ok { background: var(--green); box-shadow: 0 0 10px var(--green); }
    .dot.err { background: var(--red); box-shadow: 0 0 10px var(--red); }
    .dot.idle { background: var(--yellow); }
    h1 { font-size: 19px; font-weight: 600; letter-spacing: -0.3px; }
    .meta { font-size: 12px; color: var(--muted); margin-left: auto; text-align: right; line-height: 1.7; }
    .cards { display: flex; flex-direction: column; gap: 10px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 22px 24px; display: grid; grid-template-columns: 1fr auto auto auto; align-items: center; gap: 18px; transition: border-color 0.15s; }
    .card:hover { border-color: var(--border2); }
    .card.ok { border-left: 3px solid var(--green); }
    .card.err { border-left: 3px solid var(--red); }
    .card-url { display: flex; flex-direction: column; gap: 5px; }
    .url-link { font-family: "SF Mono", "Fira Code", monospace; font-size: 13.5px; color: var(--text); text-decoration: none; word-break: break-all; }
    .url-link:hover { color: var(--accent); text-decoration: underline; }
    .url-label { font-size: 11px; color: var(--muted); }
    .badge { font-size: 11.5px; font-weight: 600; padding: 5px 12px; border-radius: 20px; white-space: nowrap; }
    .badge.ok { background: var(--green-dim); color: var(--green); }
    .badge.err { background: var(--red-dim); color: var(--red); }
    .latency { font-size: 13px; color: var(--muted); white-space: nowrap; min-width: 52px; text-align: right; }
    .remove-btn { background: none; border: 1px solid var(--border); color: var(--muted); border-radius: 8px; padding: 5px 10px; font-size: 12px; cursor: pointer; transition: all 0.15s; white-space: nowrap; }
    .remove-btn:hover { border-color: var(--red); color: var(--red); }
    .empty { color: var(--muted); padding: 2rem 0; text-align: center; }
    .footer { margin-top: 2rem; font-size: 12px; color: var(--muted); }
    .add-section { margin-top: 2rem; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 22px 24px; }
    .add-section h2 { font-size: 14px; font-weight: 500; margin-bottom: 14px; color: var(--text); }
    .add-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .prefix { font-family: "SF Mono", "Fira Code", monospace; font-size: 13px; color: var(--muted); background: var(--surface2); border: 1px solid var(--border); border-radius: 8px 0 0 8px; padding: 9px 12px; white-space: nowrap; border-right: none; }
    .add-row input { flex: 1; min-width: 160px; background: var(--surface2); border: 1px solid var(--border); border-left: none; border-radius: 0 8px 8px 0; color: var(--text); padding: 9px 12px; font-size: 13px; font-family: "SF Mono", "Fira Code", monospace; outline: none; transition: border-color 0.15s; }
    .add-row input:focus { border-color: var(--accent); }
    .add-row input::placeholder { color: var(--muted); }
    .pw-input { flex: 0 0 auto; width: 140px; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; color: var(--text); padding: 9px 12px; font-size: 13px; outline: none; transition: border-color 0.15s; }
    .pw-input:focus { border-color: var(--accent); }
    .pw-input::placeholder { color: var(--muted); }
    .add-btn { background: var(--accent); border: none; color: #fff; border-radius: 8px; padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; transition: opacity 0.15s; white-space: nowrap; }
    .add-btn:hover { opacity: 0.85; }
    .msg { margin-top: 10px; font-size: 12px; }
    .msg.ok { color: var(--green); }
    .msg.err { color: var(--red); }
  </style>
</head>
<body>
  <div class="header">
    <div class="dot ${lastResults.length === 0 ? "idle" : allOk ? "ok" : "err"}"></div>
    <h1>Pinger</h1>
    <div class="meta">
      Last ping: ${lastPingTime || "waiting..."}<br>
      Auto-refreshes every 30s
    </div>
  </div>

  <div class="cards" id="cards">
    ${lastResults.length
      ? lastResults.map((r) => `
    <div class="card ${r.ok ? "ok" : "err"}" data-url="${r.url}">
      <div class="card-url">
        <a class="url-link" href="${r.url}" target="_blank" rel="noopener">${r.url}</a>
        <span class="url-label">${r.ok ? "online" : "unreachable"}</span>
      </div>
      <div class="badge ${r.ok ? "ok" : "err"}">${r.ok ? r.status : r.error || "error"}</div>
      <div class="latency">${r.ms != null ? r.ms + "ms" : "--"}</div>
      ${r.url !== "${SELF_URL}" ? `<button class="remove-btn" onclick="removeService('${r.url}')">remove</button>` : `<div></div>`}
    </div>`).join("")
      : `<div class="empty">Waiting for first ping...</div>`
    }
  </div>

  <div class="add-section">
    <h2>Add service</h2>
    <div class="add-row">
      <span class="prefix">https://</span>
      <input id="newUrl" type="text" placeholder="yourapp.onrender.com" autocomplete="off" spellcheck="false">
      <input id="pw" class="pw-input" type="password" placeholder="password">
      <button class="add-btn" onclick="addService()">Add</button>
    </div>
    <div class="msg" id="msg"></div>
  </div>

  <div class="footer">Watching ${allURLs().length} service${allURLs().length !== 1 ? "s" : ""} every ${INTERVAL_MS / 60000} min</div>

  <script>
    async function addService() {
      const url = document.getElementById('newUrl').value.trim();
      const password = document.getElementById('pw').value;
      const msg = document.getElementById('msg');
      if (!url) { showMsg('enter a url', 'err'); return; }
      const res = await fetch('/api/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, password })
      });
      const data = await res.json();
      if (data.ok) {
        showMsg('added ' + data.url + ' — will appear on next ping', 'ok');
        document.getElementById('newUrl').value = '';
      } else {
        showMsg(data.error || 'error', 'err');
      }
    }

    async function removeService(url) {
      const password = document.getElementById('pw').value || prompt('Password:');
      if (!password) return;
      const res = await fetch('/api/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, password })
      });
      const data = await res.json();
      if (data.ok) {
        const card = document.querySelector('[data-url="' + url + '"]');
        if (card) card.remove();
        showMsg('removed ' + url, 'ok');
      } else {
        showMsg(data.error || 'error', 'err');
      }
    }

    document.getElementById('newUrl').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addService();
    });

    function showMsg(text, type) {
      const msg = document.getElementById('msg');
      msg.textContent = text;
      msg.className = 'msg ' + type;
    }
  </script>
</body>
</html>`);
});

server.listen(PORT, () => {
  console.log(`[${timestamp()}] Running on port ${PORT}`);
  console.log(`[${timestamp()}] Interval: ${INTERVAL_MS / 60000} min`);
  allURLs().forEach((u) => console.log(`   ${u}`));
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
