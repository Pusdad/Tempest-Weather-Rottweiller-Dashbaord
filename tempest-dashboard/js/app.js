/* ============================================================
 * Tempest Dashboard — main application
 * ============================================================ */

(() => {
  const $ = (id) => document.getElementById(id);

  const DEFAULT_STATION = "49085";
  const store = {
    get token() { return localStorage.getItem("tempest_token") || ""; },
    set token(v) { localStorage.setItem("tempest_token", v); },
    get stationId() { return localStorage.getItem("tempest_station") || DEFAULT_STATION; },
    set stationId(v) { localStorage.setItem("tempest_station", v); },
    get units() { return localStorage.getItem("tempest_units") || "imperial"; },
    set units(v) { localStorage.setItem("tempest_units", v); },
  };

  const state = {
    deviceId: null,
    closeSocket: null,
    historyDays: 3,
    historyRows: [],
    forecast: null,
    forecastMode: "daily",
    lastStationObs: null,
  };

  const ICONS = {
    "clear-day": "☀️", "clear-night": "🌙", "cloudy": "☁️", "foggy": "🌫️",
    "partly-cloudy-day": "⛅", "partly-cloudy-night": "☁️",
    "possibly-rainy-day": "🌦️", "possibly-rainy-night": "🌧️", "rainy": "🌧️",
    "possibly-sleet-day": "🌨️", "possibly-sleet-night": "🌨️", "sleet": "🌨️",
    "possibly-snow-day": "🌨️", "possibly-snow-night": "🌨️", "snow": "❄️",
    "possibly-thunderstorm-day": "⛈️", "possibly-thunderstorm-night": "⛈️", "thunderstorm": "⛈️",
    "windy": "💨",
  };
  const icon = (name) => ICONS[name] || "🌡️";

  /* ============ Setup modal ============ */
  function showModal(errorMsg) {
    $("token-input").value = store.token;
    $("station-input").value = store.stationId;
    const err = $("modal-error");
    err.hidden = !errorMsg;
    if (errorMsg) err.textContent = errorMsg;
    $("setup-modal").hidden = false;
  }

  $("settings-btn").onclick = () => showModal();

  $("save-settings").onclick = async () => {
    const token = $("token-input").value.trim();
    const stationId = $("station-input").value.trim();
    if (!token) { showModal("Please paste your personal access token."); return; }
    const btn = $("save-settings");
    btn.disabled = true; btn.textContent = "Connecting…";
    try {
      await TempestAPI.getStation(stationId, token);
      store.token = token;
      store.stationId = stationId;
      $("setup-modal").hidden = true;
      boot();
    } catch (e) {
      showModal(e.status === 401 ? "That token was rejected (401). Double-check it at tempestwx.com/settings/tokens."
        : `Could not reach the station: ${e.message}`);
    } finally {
      btn.disabled = false; btn.textContent = "Connect";
    }
  };

  /* ============ Live status pill ============ */
  function setStatus(s) {
    const pill = $("live-pill");
    pill.classList.toggle("live", s === "live");
    pill.classList.toggle("offline", s === "offline");
    $("live-label").textContent = s === "live" ? "LIVE" : s === "offline" ? "RECONNECTING" : "CONNECTING";
    $("wind-live-tag").classList.toggle("on", s === "live");
  }

  function stampUpdated(epoch) {
    const d = epoch ? new Date(epoch * 1000) : new Date();
    $("last-updated").textContent = "Updated " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  }

  /* ============ Current conditions rendering ============ */
  function uvDesc(uv) {
    if (uv == null) return "—";
    if (uv < 3) return "Low";
    if (uv < 6) return "Moderate";
    if (uv < 8) return "High";
    if (uv < 11) return "Very High";
    return "Extreme";
  }

  /** Render from the station observation object (named fields, metric). */
  function renderStationObs(obs) {
    state.lastStationObs = obs;
    $("cc-temp").textContent = Units.format("temp", obs.air_temperature);
    $("cc-temp-unit").textContent = Units.label("temp");
    $("cc-feels").textContent = Units.format("temp", obs.feels_like) + "°";
    $("cc-humidity").textContent = Units.fmt(obs.relative_humidity, 0);
    $("cc-dewpoint").textContent = Units.format("temp", obs.dew_point) + "°";
    $("cc-pressure").textContent = Units.format("pressure", obs.sea_level_pressure ?? obs.barometric_pressure);
    $("cc-pressure-unit").textContent = Units.label("pressure");
    $("cc-rain").textContent = Units.format("rain", obs.precip_accum_local_day);
    $("cc-rain-unit").textContent = Units.label("rain");
    $("cc-rain-yest").textContent = Units.format("rain", obs.precip_accum_local_yesterday) + " " + Units.label("rain");
    $("cc-uv").textContent = Units.fmt(obs.uv, 1);
    $("cc-uv-desc").textContent = uvDesc(obs.uv);
    $("cc-solar").textContent = Units.fmt(obs.solar_radiation, 0);
    $("cc-brightness").textContent = obs.brightness != null ? obs.brightness.toLocaleString() : "--";
    $("cc-lightning").textContent = Units.fmt(obs.lightning_strike_count_last_3hr, 0);
    $("cc-lightning-dist").textContent = obs.lightning_strike_last_distance != null
      ? `Last ${Units.format("distance", obs.lightning_strike_last_distance)} ${Units.label("distance")} away`
      : "None detected";
    renderWind(obs.wind_avg, obs.wind_gust, obs.wind_lull, obs.wind_direction);
    stampUpdated(obs.timestamp);
  }

  /** Render from a websocket obs_st array (metric). */
  function renderDeviceObs(o) {
    const mapped = {
      ...state.lastStationObs,
      timestamp: o[0], wind_lull: o[1], wind_avg: o[2], wind_gust: o[3], wind_direction: o[4],
      barometric_pressure: o[6], air_temperature: o[7], relative_humidity: o[8],
      brightness: o[9], uv: o[10], solar_radiation: o[11],
    };
    // sea-level pressure & feels-like need server-side calc; refresh those via REST below
    renderStationObs(mapped);
  }

  function renderWind(avg, gust, lull, dir) {
    $("wind-avg").textContent = Units.format("wind", avg);
    $("wind-gust").textContent = Units.format("wind", gust);
    $("wind-lull").textContent = Units.format("wind", lull);
    $("wind-dir").textContent = dir != null ? `${degToCardinal(dir)} ${Math.round(dir)}°` : "--";
    $("wind-unit").textContent = Units.label("wind");
    if (avg != null) $("wind-speed").textContent = Units.format("wind", avg, avg < 10 ? 1 : 0);
    if (dir != null) $("needle").style.transform = `rotate(${dir}deg)`;
  }

  /* Rapid wind: 3-second updates drive the compass needle + center speed. */
  function onRapidWind(epoch, speedMps, dirDeg) {
    $("wind-speed").textContent = Units.format("wind", speedMps, speedMps * 2.23694 < 10 ? 1 : 0);
    $("needle").style.transform = `rotate(${dirDeg}deg)`;
    $("wind-dir").textContent = `${degToCardinal(dirDeg)} ${Math.round(dirDeg)}°`;
  }

  /* ============ Forecast ============ */
  function renderForecast() {
    const strip = $("forecast-strip");
    const fc = state.forecast;
    if (!fc) { strip.innerHTML = '<div class="placeholder">Forecast unavailable</div>'; return; }

    // Hero condition summary comes from forecast current_conditions
    const cc = fc.current_conditions;
    if (cc) {
      $("cc-icon").textContent = icon(cc.icon);
      $("cc-conditions").textContent = cc.conditions || "—";
      $("cc-pressure-trend").textContent = cc.pressure_trend
        ? cc.pressure_trend[0].toUpperCase() + cc.pressure_trend.slice(1)
        : "—";
    }
    const today = fc.forecast?.daily?.[0];
    if (today) {
      $("cc-high").textContent = Units.format("temp", today.air_temp_high) + "°";
      $("cc-low").textContent = Units.format("temp", today.air_temp_low) + "°";
    }

    if (state.forecastMode === "daily") {
      const days = fc.forecast?.daily || [];
      strip.innerHTML = days.slice(0, 10).map((d) => {
        const day = new Date(d.day_start_local * 1000).toLocaleDateString([], { weekday: "short" });
        return `<div class="fc-card">
          <div class="fc-day">${day}</div>
          <div class="fc-icon">${icon(d.icon)}</div>
          <div class="fc-temps">${Units.format("temp", d.air_temp_high)}° <span class="lo">${Units.format("temp", d.air_temp_low)}°</span></div>
          <div class="fc-precip">${d.precip_probability != null ? "💧 " + d.precip_probability + "%" : "&nbsp;"}</div>
        </div>`;
      }).join("");
    } else {
      const hours = fc.forecast?.hourly || [];
      strip.innerHTML = hours.slice(0, 24).map((h) => {
        const hr = new Date(h.time * 1000).toLocaleTimeString([], { hour: "numeric" });
        return `<div class="fc-card">
          <div class="fc-day">${hr}</div>
          <div class="fc-icon">${icon(h.icon)}</div>
          <div class="fc-temps">${Units.format("temp", h.air_temperature)}°</div>
          <div class="fc-precip">${h.precip_probability != null ? "💧 " + h.precip_probability + "%" : "&nbsp;"}</div>
        </div>`;
      }).join("");
    }
  }

  $("forecast-toggle").onclick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.forecastMode = btn.dataset.mode;
    [...$("forecast-toggle").children].forEach((b) => b.classList.toggle("active", b === btn));
    renderForecast();
  };

  /* ============ History ============ */
  async function loadHistory() {
    if (!state.deviceId) return;
    $("history-loading").hidden = false;
    try {
      const end = Math.floor(Date.now() / 1000);
      const start = end - state.historyDays * 86400;
      let rows = await TempestAPI.getDeviceHistory(state.deviceId, store.token, start, end);
      // keep chart point counts sane on long ranges
      const MAX_POINTS = 1500;
      if (rows.length > MAX_POINTS) {
        const step = Math.ceil(rows.length / MAX_POINTS);
        rows = rows.filter((_, i) => i % step === 0);
      }
      state.historyRows = rows;
      Charts.render(rows);
    } catch (e) {
      console.error("History load failed:", e);
    } finally {
      $("history-loading").hidden = true;
    }
  }

  $("range-toggle").onclick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    state.historyDays = Number(btn.dataset.range);
    [...$("range-toggle").children].forEach((b) => b.classList.toggle("active", b === btn));
    loadHistory();
  };

  /* ============ Units toggle ============ */
  $("unit-toggle").onclick = (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    store.units = btn.dataset.units;
    Units.system = btn.dataset.units;
    [...$("unit-toggle").children].forEach((b) => b.classList.toggle("active", b === btn));
    if (state.lastStationObs) renderStationObs(state.lastStationObs);
    renderForecast();
    Charts.render(state.historyRows);
  };

  /* ============ Compass tick marks ============ */
  (function buildTicks() {
    const g = $("compass-ticks");
    let html = "";
    for (let a = 0; a < 360; a += 22.5) {
      const rad = (a * Math.PI) / 180;
      const r1 = 92, r2 = a % 90 === 0 ? 82 : 87;
      const x1 = 100 + r1 * Math.sin(rad), y1 = 100 - r1 * Math.cos(rad);
      const x2 = 100 + r2 * Math.sin(rad), y2 = 100 - r2 * Math.cos(rad);
      html += `<line class="compass-tick" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
    }
    g.innerHTML = html;
  })();

  /* ============ Boot ============ */
  async function refreshCurrent() {
    try {
      const data = await TempestAPI.getStationObservation(store.stationId, store.token);
      if (data.obs?.[0]) renderStationObs(data.obs[0]);
    } catch (e) {
      console.error("Observation refresh failed:", e);
    }
  }

  async function refreshForecast() {
    try {
      state.forecast = await TempestAPI.getForecast(store.stationId, store.token);
      renderForecast();
    } catch (e) {
      console.error("Forecast load failed:", e);
    }
  }

  async function boot() {
    state.closeSocket?.();
    Units.system = store.units;
    [...$("unit-toggle").children].forEach((b) =>
      b.classList.toggle("active", b.dataset.units === store.units));

    let station;
    try {
      station = await TempestAPI.getStation(store.stationId, store.token);
    } catch (e) {
      showModal(e.status === 401 || e.status === 404
        ? "Your token or station ID was rejected. Please re-enter them."
        : `Could not load station: ${e.message}`);
      return;
    }

    const st = station.stations?.[0];
    if (st) {
      $("station-name").textContent = st.public_name || st.name || "Tempest Station";
      document.title = `${st.public_name || st.name} · Tempest Dashboard`;
      $("station-location").textContent =
        st.latitude != null ? `${st.latitude.toFixed(3)}, ${st.longitude.toFixed(3)}` : "—";
      $("station-elevation").textContent = st.station_meta?.elevation != null
        ? `${Units.format("elevation", st.station_meta.elevation, 0)} ${Units.label("elevation")} elevation`
        : "—";
      const tempestDevice = (st.devices || []).find((d) => d.device_type === "ST");
      state.deviceId = tempestDevice?.device_id ?? null;
    }

    refreshCurrent();
    refreshForecast();
    loadHistory();

    // Live feed + periodic REST refresh (REST supplies derived fields like
    // feels-like and sea-level pressure that the raw device obs lack).
    if (state.deviceId) {
      state.closeSocket = TempestAPI.openSocket(state.deviceId, store.token, {
        onObs: renderDeviceObs,
        onRapidWind,
        onStatus: setStatus,
      });
    }
    setInterval(refreshCurrent, 60_000);
    setInterval(refreshForecast, 15 * 60_000);
  }

  if (store.token) {
    boot();
  } else {
    showModal();
  }
})();
