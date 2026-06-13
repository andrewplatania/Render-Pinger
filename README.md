# render-pinger

Keeps Render free-tier web services alive by pinging them every N minutes. Zero dependencies, pure Node.js.

## Deploy to Render

1. Push this folder to a GitHub repo
2. On Render, create a New Web Service and connect your repo
3. Set:
   - **Build command:** `yarn`
   - **Start command:** `node index.js`
   - **Instance type:** Free

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PING_URLS` | none | Comma-separated extra URLs to ping |
| `PING_INTERVAL_MS` | `10` | Interval in minutes between pings |
| `PORT` | `3000` | Set automatically by Render |

Example:
```
PING_URLS=https://remotedb.us,https://myapi.onrender.com
PING_INTERVAL_MS=10
```

## How it works

The pinger always pings itself using `RENDER_EXTERNAL_URL` (set automatically by Render), so it stays alive. Any URLs in `PING_URLS` get pinged at the same interval. Visit the service URL in a browser to see a live status page with latency and HTTP status for each URL.
