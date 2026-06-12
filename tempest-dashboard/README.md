# ⛈️ Tempest Weather Dashboard

A dynamic, real-time + historical dashboard for [Tempest station 49085](https://tempestwx.com/station/49085), built as a pure static web app — no build step, no server, no dependencies to install.

![Dashboard](https://img.shields.io/badge/stack-vanilla%20JS%20%2B%20Chart.js-38bdf8)

## Features

- **Live conditions** — temperature, feels-like, humidity, dew point, pressure + trend, rain today/yesterday, UV, solar radiation, brightness, lightning
- **Real-time wind compass** — animated needle driven by the Tempest **3-second rapid wind** WebSocket feed, plus lull/avg/gust
- **Live updates** — per-minute observations stream over WebSocket with automatic reconnect; REST refresh as a fallback
- **Forecast** — 10-day and 24-hour forecast strips from WeatherFlow's "better forecast" API
- **History charts** — temperature/humidity, wind, pressure, rainfall, solar/UV, and lightning over 24H / 3D / 7D / 30D / 90D / 1Y, with **scroll-to-zoom and drag-to-pan** (double-click to reset)
- **Unit toggle** — imperial (°F, mph, in, inHg) ⇄ metric (°C, km/h, mm, mb), remembered across visits

## Quick start

### 1. Get a (free) personal access token

The WeatherFlow API requires a token even for your own station:

1. Sign in at **[tempestwx.com/settings/tokens](https://tempestwx.com/settings/tokens)**
2. Click **Create Token**, name it anything (e.g. "Dashboard")
3. Copy the token

### 2. Run the dashboard

Any static file server works. The simplest:

```bash
cd tempest-dashboard
python3 -m http.server 8080
```

Open <http://localhost:8080>, paste your token when prompted, and you're live. The token is stored only in your browser's localStorage and is sent only to the WeatherFlow API.

> You can also just double-click `index.html` — the WeatherFlow API allows cross-origin requests, so it works from `file://` too in most browsers.

### Hosting it permanently

Because it's pure static files, you can drop the `tempest-dashboard/` folder onto **GitHub Pages, Netlify, Cloudflare Pages**, or a Raspberry Pi on your LAN. Each browser that visits will be prompted once for a token.

## Configuration

Click the ⚙️ button in the header to change the token or point the dashboard at a different station ID (default: `49085`).

## How it works

| Data | Source |
|---|---|
| Current conditions | `GET /observations/station/{id}` (REST, every 60 s) |
| Live obs + 3-sec wind | `wss://ws.weatherflow.com/swd/data` (`listen_start` + `listen_rapid_start`) |
| Forecast | `GET /better_forecast?station_id={id}` |
| History | `GET /observations/device/{deviceId}?time_start&time_end` (auto-bucketed; chunked for long ranges) |

All data is requested in metric and converted client-side, so the unit toggle is instant and applies everywhere, including the charts.

## Files

```
tempest-dashboard/
├── index.html      # layout
├── css/style.css   # dark glassmorphism theme
└── js/
    ├── api.js      # WeatherFlow REST + WebSocket wrapper, unit conversion
    ├── charts.js   # Chart.js chart builders (zoom/pan enabled)
    └── app.js      # state, rendering, live updates, settings modal
```
