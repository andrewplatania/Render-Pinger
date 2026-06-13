# render-pinger

Keeps Render free-tier services alive by pinging them every 10 minutes so they never spin down. Zero dependencies, pure Node.js. Includes a status dashboard at the service URL.

## Deploy

**1. Fork this repo**

Click Fork at the top right of this page.

**2. Create a new Render Web Service**

Go to [render.com](https://render.com), click New, then Web Service, and connect your forked repo.

**3. Configure the service**

- Build command: `yarn`
- Start command: `node index.js`
- Instance type: Free

**4. Set environment variables**

| Variable | Required | Description |
|---|---|---|
| `PING_URLS` | No | Comma-separated list of URLs to ping. No need to type `https://` — it is added automatically if missing. |
| `PING_INTERVAL_MS` | No | Ping interval in minutes. Defaults to 10. |

Example:
```
PING_URLS=remotedb.us,myapp.onrender.com,anotherapp.onrender.com
```

To add or remove a service, update `PING_URLS` in your Render environment variables and redeploy.

## Notes

- The pinger always pings itself using `RENDER_EXTERNAL_URL`, which Render sets automatically, so it stays alive without any extra config.
- All pings run concurrently.
- The dashboard auto-refreshes every 30 seconds.
- Times are shown in US Central time.
