/* ============================================================
 * Chart.js builders for the history section
 * ============================================================ */

const Charts = (() => {
  const GRID = "rgba(255,255,255,0.06)";
  const TICK = "#94a3c2";
  const charts = {};

  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.color = TICK;

  function baseOptions(yTitle, extraScales = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 350 },
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: {
        legend: { labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: "circle" } },
        tooltip: {
          backgroundColor: "rgba(10,15,30,0.92)",
          borderColor: "rgba(255,255,255,0.12)",
          borderWidth: 1,
          padding: 10,
        },
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" },
        },
      },
      scales: {
        x: {
          type: "time",
          grid: { color: GRID },
          ticks: { maxTicksLimit: 8, maxRotation: 0 },
          time: { tooltipFormat: "MMM d, h:mm a" },
        },
        y: {
          grid: { color: GRID },
          title: { display: !!yTitle, text: yTitle },
        },
        ...extraScales,
      },
    };
  }

  function gradient(ctx, rgb) {
    const g = ctx.createLinearGradient(0, 0, 0, 260);
    g.addColorStop(0, `rgba(${rgb}, 0.30)`);
    g.addColorStop(1, `rgba(${rgb}, 0.0)`);
    return g;
  }

  function line(color, rgb, label, data, opts = {}) {
    return {
      label, data,
      borderColor: color,
      backgroundColor: (c) => gradient(c.chart.ctx, rgb),
      borderWidth: 2,
      pointRadius: 0,
      pointHitRadius: 8,
      tension: 0.3,
      fill: opts.fill ?? true,
      ...opts,
    };
  }

  function destroyAll() {
    Object.values(charts).forEach((c) => c.destroy());
    Object.keys(charts).forEach((k) => delete charts[k]);
  }

  /**
   * Build/rebuild all six charts from obs_st history rows.
   * Rows are raw metric obs_st arrays; conversion uses the active unit system.
   */
  function render(rows) {
    destroyAll();
    if (!rows.length) return;

    const pt = (r, idx, kind) => ({
      x: r[0] * 1000,
      y: kind ? Units.convert(kind, r[idx]) : r[idx],
    });

    const temp     = rows.map((r) => pt(r, 7, "temp"));
    const humidity = rows.map((r) => pt(r, 8, null));
    const windAvg  = rows.map((r) => pt(r, 2, "wind"));
    const windGust = rows.map((r) => pt(r, 3, "wind"));
    const pressure = rows.map((r) => pt(r, 6, "pressure"));
    const rain     = rows.map((r) => pt(r, 12, "rain"));
    const solar    = rows.map((r) => pt(r, 11, null));
    const uv       = rows.map((r) => pt(r, 10, null));
    const strikes  = rows.map((r) => pt(r, 15, null));

    charts.temp = new Chart(document.getElementById("chart-temp"), {
      type: "line",
      data: { datasets: [
        line("#38bdf8", "56,189,248", `Temperature (${Units.label("temp")})`, temp),
        line("#a78bfa", "167,139,250", "Humidity (%)", humidity, { fill: false, yAxisID: "y2", borderDash: [5, 4] }),
      ]},
      options: baseOptions(Units.label("temp"), {
        y2: { position: "right", min: 0, max: 100, grid: { drawOnChartArea: false }, title: { display: true, text: "%" } },
      }),
    });

    charts.wind = new Chart(document.getElementById("chart-wind"), {
      type: "line",
      data: { datasets: [
        line("#34d399", "52,211,153", `Avg (${Units.label("wind")})`, windAvg),
        line("#fbbf24", "251,191,36", `Gust (${Units.label("wind")})`, windGust, { fill: false }),
      ]},
      options: baseOptions(Units.label("wind")),
    });

    charts.pressure = new Chart(document.getElementById("chart-pressure"), {
      type: "line",
      data: { datasets: [
        line("#f472b6", "244,114,182", `Pressure (${Units.label("pressure")})`, pressure),
      ]},
      options: baseOptions(Units.label("pressure")),
    });

    charts.rain = new Chart(document.getElementById("chart-rain"), {
      type: "bar",
      data: { datasets: [{
        label: `Rain (${Units.label("rain")})`,
        data: rain,
        backgroundColor: "rgba(56,189,248,0.65)",
        borderRadius: 2,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
      }]},
      options: baseOptions(Units.label("rain")),
    });

    charts.solar = new Chart(document.getElementById("chart-solar"), {
      type: "line",
      data: { datasets: [
        line("#fbbf24", "251,191,36", "Solar (W/m²)", solar),
        line("#a78bfa", "167,139,250", "UV Index", uv, { fill: false, yAxisID: "y2" }),
      ]},
      options: baseOptions("W/m²", {
        y2: { position: "right", min: 0, grid: { drawOnChartArea: false }, title: { display: true, text: "UV" } },
      }),
    });

    charts.lightning = new Chart(document.getElementById("chart-lightning"), {
      type: "bar",
      data: { datasets: [{
        label: "Strikes",
        data: strikes,
        backgroundColor: "rgba(251,191,36,0.7)",
        borderRadius: 2,
        barPercentage: 1.0,
        categoryPercentage: 1.0,
      }]},
      options: baseOptions("count"),
    });

    // double-click resets zoom on every chart
    Object.values(charts).forEach((c) => {
      c.canvas.ondblclick = () => c.resetZoom();
    });
  }

  return { render };
})();
