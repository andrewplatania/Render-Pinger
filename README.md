# render-pinger

Keeps Render free-tier web services alive by pinging them every N minutes.
Zero dependencies — pure Node.js.

## Deploy to Render

1. Push this folder to a GitHub repo
2. On Render → **New Web Service** → connect your repo
3. Set:
   - **Build command:** *(leave blank)*
   - **Start command:** `node index.js`
   - **Instance type:** Free

## Configuration (Environment Variables)

| Variable | Default | Description |
|---|---|---|
| `PING_URLS` | hardcoded list | Comma-separated URLs to ping |
| `PING_INTERVAL_MS` | `10` | Interval in **minutes** between pings |
| `PORT` | `3000` | HTTP port (Render sets this automatically) |

### Example env vars on Render:
```
PING_URLS=https://myapp.onrender.com,https://myapi.onrender.com,https://remotedb.us
PING_INTERVAL_MS=10
```

## Status Page

Visit your pinger's Render URL in a browser to see a live status table
showing last ping results, latency, and HTTP status for each URL.

## Notes

- Pings once immediately on startup, then on the interval
- Uses `Promise.all` so all URLs are hit concurrently
- The pinger itself stays alive because Render keeps any HTTP server running
- Set interval to **10 min** or less — Render spins down after 15 min of inactivity
