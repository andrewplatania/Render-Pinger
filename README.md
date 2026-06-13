# render-pinger

A self-hosted uptime pinger that keeps your Render free-tier services alive. Pings a list of URLs on an interval so they never spin down. Includes a dashboard to add and remove services without touching any code.

## How it works

Render free-tier services spin down after 15 minutes of inactivity. This pinger runs as its own Render service, pings itself every 10 minutes to stay alive, and pings any other services you add alongside it.

## Deploy

**1. Fork this repo**

Click the Fork button at the top right of this page to copy it to your GitHub account.

**2. Create a new Render Web Service**

Go to [render.com](https://render.com), click New, then Web Service, and connect your forked repo.

**3. Configure the service**

Use these settings:

- Build command: `yarn`
- Start command: `node index.js`
- Instance type: Free

**4. Set environment variables**

In your Render service settings under Environment, add:

| Variable | Required | Description |
|---|---|---|
| `DASHBOARD_PASSWORD` | Yes | Password to add/remove services from the dashboard |
| `PING_URLS` | No | Comma-separated URLs to ping on startup (you can also add them from the dashboard later) |
| `PING_INTERVAL_MS` | No | Ping interval in minutes. Defaults to 10 |

Example:
```
DASHBOARD_PASSWORD=mysecretpassword
PING_URLS=remotedb.us,myapp.onrender.com
```

No need to type `https://` — it is added automatically.

**5. Deploy**

Click Deploy. Once it is live, visit your Render service URL to see the dashboard.

## Dashboard

The dashboard shows the status and latency of every service being watched. Click any URL to open it in a new tab. Use the Add Service form at the bottom to add new URLs, and the remove button on each card to remove one. Both actions require your `DASHBOARD_PASSWORD`.

Services added through the dashboard are stored in memory and will reset if the service restarts. For permanent services, add them to `PING_URLS` in your environment variables.

## Notes

- The pinger always pings itself using the `RENDER_EXTERNAL_URL` variable that Render sets automatically, so it stays alive without any extra config
- All pings run concurrently
- The dashboard auto-refreshes every 30 seconds
- Times are shown in US Central time
