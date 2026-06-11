/* ============================================================
 * Chart.js: one large tabbed history chart
 * ============================================================ */

const Charts = (() => {
  const GRID = "rgba(255,255,255,0.06)";
  const TICK = "#8e9cc0";
  let rows = [];
  let kind = "temp";
  let chart = null;

  Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
  Chart.defaults.color = TICK;

  function baseOptions(yTitle, extraScales = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400, easing: "easeOutQuart" },
      interaction: { mode: "nearest", axis: "x", intersect: false },
      plugins: {
        legend: { labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: "circle" } },
        tooltip: {
          backgroundColor: "rgba(7,11,22,0.92)",
          borderColor: "rgba(255,255,255,0.12)",
          borderWidth: 1,
          padding: 12,
          titleFont: { weight: "700" },
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
          ticks: { maxTicksLimit: 10, maxRotation: 0 },
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

  function gradient(ctx, area, rgb) {
    const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    g.addColorStop(0, `rgba(${rgb}, 0.32)`);
    g.addColorStop(1, `rgba(${rgb}, 0.0)`);
    return g;
  }

  function line(color, rgb, label, data, opts = {}) {
    return {
      label, data,
      borderColor: color,
      backgroundColor: (c) => c.chart.chartArea ? gradient(c.chart.ctx, c.chart.chartArea, rgb) : `rgba(${rgb},0.1)`,
      borderWidth: 2.2,
      pointRadius: 0,
      pointHitRadius: 8,
      tension: 0.3,
      fill: opts.fill ?? true,
      ...opts,
    };
  }

  function bar(rgb, label, data) {
    return {
      label, data,
      backgroundColor: `rgba(${rgb}, 0.7)`,
      borderRadius: 3,
      barPercentage: 1.0,
      categoryPercentage: 1.0,
    };
  }

  const pt = (r, idx, unitKind) => ({
    x: r[0] * 1000,
    y: unitKind ? Units.convert(unitKind, r[idx]) : r[idx],
  });

  /* obs_st indices: 2 wind avg, 3 gust, 6 pressure, 7 temp, 8 RH,
     10 UV, 11 solar, 12 rain, 15 strikes */
  const BUILDERS = {
    temp: () => ({
      type: "line",
      data: { datasets: [
        line("#38bdf8", "56,189,248", `Temperature (${Units.label("temp")})`, rows.map((r) => pt(r, 7, "temp"))),
        line("#a78bfa", "167,139,250", "Humidity (%)", rows.map((r) => pt(r, 8, null)),
          { fill: false, yAxisID: "y2", borderDash: [5, 4], borderWidth: 1.6 }),
      ]},
      options: baseOptions(Units.label("temp"), {
        y2: { position: "right", min: 0, max: 100, grid: { drawOnChartArea: false }, title: { display: true, text: "%" } },
      }),
    }),
    wind: () => ({
      type: "line",
      data: { datasets: [
        line("#34d399", "52,211,153", `Avg (${Units.label("wind")})`, rows.map((r) => pt(r, 2, "wind"))),
        line("#fbbf24", "251,191,36", `Gust (${Units.label("wind")})`, rows.map((r) => pt(r, 3, "wind")), { fill: false }),
      ]},
      options: baseOptions(Units.label("wind")),
    }),
    pressure: () => ({
      type: "line",
      data: { datasets: [
        line("#f472b6", "244,114,182", `Pressure (${Units.label("pressure")})`, rows.map((r) => pt(r, 6, "pressure"))),
      ]},
      options: baseOptions(Units.label("pressure")),
    }),
    rain: () => ({
      type: "bar",
      data: { datasets: [
        bar("56,189,248", `Rain (${Units.label("rain")})`, rows.map((r) => pt(r, 12, "rain"))),
      ]},
      options: baseOptions(Units.label("rain")),
    }),
    solar: () => ({
      type: "line",
      data: { datasets: [
        line("#fbbf24", "251,191,36", "Solar (W/m²)", rows.map((r) => pt(r, 11, null))),
        line("#a78bfa", "167,139,250", "UV Index", rows.map((r) => pt(r, 10, null)), { fill: false, yAxisID: "y2" }),
      ]},
      options: baseOptions("W/m²", {
        y2: { position: "right", min: 0, grid: { drawOnChartArea: false }, title: { display: true, text: "UV" } },
      }),
    }),
    lightning: () => ({
      type: "bar",
      data: { datasets: [
        bar("251,191,36", "Strikes", rows.map((r) => pt(r, 15, null))),
      ]},
      options: baseOptions("count"),
    }),
  };

  function build() {
    chart?.destroy();
    chart = null;
    if (!rows.length) return;
    const canvas = document.getElementById("chart-main");
    chart = new Chart(canvas, BUILDERS[kind]());
    canvas.ondblclick = () => chart?.resetZoom();
  }

  return {
    setData(r) { rows = r; build(); },
    show(k) { if (BUILDERS[k]) { kind = k; build(); } },
  };
})();
