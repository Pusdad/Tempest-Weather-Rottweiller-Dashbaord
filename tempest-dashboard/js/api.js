/* ============================================================
 * Tempest / WeatherFlow API layer
 * REST docs:  https://weatherflow.github.io/Tempest/api/
 * ============================================================ */

const TempestAPI = (() => {
  const REST = "https://swd.weatherflow.com/swd/rest";
  const WS_URL = "wss://ws.weatherflow.com/swd/data";

  async function getJSON(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const err = new Error(`API ${res.status}: ${body.slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  /** Station metadata (name, location, devices). */
  function getStation(stationId, token) {
    return getJSON(`${REST}/stations/${stationId}?token=${token}`);
  }

  /** Latest full observation for the station (named fields). */
  function getStationObservation(stationId, token) {
    return getJSON(`${REST}/observations/station/${stationId}?token=${token}`);
  }

  /** Forecast + current conditions. Units are handled client-side, so request metric. */
  function getForecast(stationId, token) {
    const u = "units_temp=c&units_wind=mps&units_pressure=mb&units_precip=mm&units_distance=km";
    return getJSON(`${REST}/better_forecast?station_id=${stationId}&${u}&token=${token}`);
  }

  /**
   * Historical device observations (obs_st arrays) between two epochs.
   * The API auto-buckets resolution by range; long ranges are fetched in
   * ~30-day chunks and concatenated.
   *
   * obs_st indices: 0 epoch, 2 wind avg (m/s), 3 gust, 4 dir, 6 pressure (mb),
   * 7 temp (C), 8 RH %, 9 lux, 10 UV, 11 solar (W/m²), 12 rain (mm), 15 strikes
   */
  async function getDeviceHistory(deviceId, token, startEpoch, endEpoch) {
    const CHUNK = 30 * 86400;
    const chunks = [];
    for (let t = startEpoch; t < endEpoch; t += CHUNK) {
      chunks.push([t, Math.min(t + CHUNK, endEpoch)]);
    }
    const results = await Promise.all(chunks.map(([a, b]) =>
      getJSON(`${REST}/observations/device/${deviceId}?time_start=${a}&time_end=${b}&token=${token}`)
        .catch(() => null)
    ));
    const obs = [];
    for (const r of results) {
      if (r && Array.isArray(r.obs)) obs.push(...r.obs);
    }
    obs.sort((a, b) => a[0] - b[0]);
    return obs;
  }

  /**
   * Live WebSocket feed: per-minute observations + 3-second rapid wind.
   * handlers: { onObs(obsArray), onRapidWind(epoch, speedMps, dirDeg), onStatus(state) }
   * Returns a close() function. Reconnects automatically with backoff.
   */
  function openSocket(deviceId, token, handlers) {
    let ws = null;
    let closed = false;
    let retryMs = 2000;

    function connect() {
      if (closed) return;
      handlers.onStatus?.("connecting");
      ws = new WebSocket(`${WS_URL}?token=${token}`);

      ws.onopen = () => {
        retryMs = 2000;
        ws.send(JSON.stringify({ type: "listen_start", device_id: deviceId, id: "obs" }));
        ws.send(JSON.stringify({ type: "listen_rapid_start", device_id: deviceId, id: "wind" }));
        handlers.onStatus?.("live");
      };

      ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.type === "obs_st" && Array.isArray(msg.obs) && msg.obs[0]) {
          handlers.onObs?.(msg.obs[0]);
        } else if (msg.type === "rapid_wind" && Array.isArray(msg.ob)) {
          handlers.onRapidWind?.(msg.ob[0], msg.ob[1], msg.ob[2]);
        }
      };

      ws.onclose = () => {
        if (closed) return;
        handlers.onStatus?.("offline");
        setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, 60000);
      };
      ws.onerror = () => ws.close();
    }

    connect();
    return () => { closed = true; ws?.close(); };
  }

  return { getStation, getStationObservation, getForecast, getDeviceHistory, openSocket };
})();

/* ============ Unit conversion helpers ============ */
const Units = (() => {
  const fmt = (v, d = 1) => (v == null || Number.isNaN(v)) ? "--" : Number(v).toFixed(d);

  const SYSTEMS = {
    imperial: {
      temp:     { label: "°F",   conv: (c) => c * 9 / 5 + 32, dec: 0 },
      wind:     { label: "mph",  conv: (ms) => ms * 2.23694,  dec: 1 },
      rain:     { label: "in",   conv: (mm) => mm / 25.4,     dec: 2 },
      pressure: { label: "inHg", conv: (mb) => mb * 0.029530, dec: 2 },
      distance: { label: "mi",   conv: (km) => km * 0.621371, dec: 0 },
      elevation:{ label: "ft",   conv: (m)  => m * 3.28084,   dec: 0 },
    },
    metric: {
      temp:     { label: "°C",   conv: (c) => c,        dec: 1 },
      wind:     { label: "km/h", conv: (ms) => ms * 3.6, dec: 1 },
      rain:     { label: "mm",   conv: (mm) => mm,       dec: 1 },
      pressure: { label: "mb",   conv: (mb) => mb,       dec: 1 },
      distance: { label: "km",   conv: (km) => km,       dec: 0 },
      elevation:{ label: "m",    conv: (m)  => m,        dec: 0 },
    },
  };

  let current = "imperial";

  return {
    set system(s) { current = s; },
    get system() { return current; },
    convert(kind, value) {
      if (value == null) return null;
      return SYSTEMS[current][kind].conv(value);
    },
    format(kind, value, dec) {
      const u = SYSTEMS[current][kind];
      return fmt(this.convert(kind, value), dec ?? u.dec);
    },
    label(kind) { return SYSTEMS[current][kind].label; },
    fmt,
  };
})();

/** Compass direction name from degrees. */
function degToCardinal(deg) {
  if (deg == null) return "--";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}
