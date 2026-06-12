/* ============================================================
 * Rottie: a Rottweiler gallops across the screen every 25 s.
 * Click him mid-run for a woof. Skipped entirely when the user
 * prefers reduced motion.
 * ============================================================ */

(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const SVG = `
  <svg viewBox="0 0 250 150" xmlns="http://www.w3.org/2000/svg" aria-label="Running Rottweiler">
    <g class="bob">
      <!-- far-side legs -->
      <g class="leg l-bf"><rect x="52" y="78" width="13" height="42" rx="6" fill="#0c0c10"/><rect x="52" y="104" width="13" height="16" rx="6" fill="#8a4a16"/></g>
      <g class="leg l-ff"><rect x="150" y="78" width="13" height="42" rx="6" fill="#0c0c10"/><rect x="150" y="104" width="13" height="16" rx="6" fill="#8a4a16"/></g>
      <!-- tail stub -->
      <g class="tail"><rect x="14" y="46" width="28" height="11" rx="5.5" fill="#15151a"/></g>
      <!-- body -->
      <path fill="#15151a" d="M34 62 Q36 38 78 34 L156 32 Q186 34 192 56 Q196 78 176 86 L66 90 Q36 88 34 62 Z"/>
      <!-- near-side legs -->
      <g class="leg l-bn"><rect x="66" y="80" width="14" height="44" rx="7" fill="#15151a"/><rect x="66" y="107" width="14" height="17" rx="7" fill="#a85f1e"/></g>
      <g class="leg l-fn"><rect x="164" y="80" width="14" height="44" rx="7" fill="#15151a"/><rect x="164" y="107" width="14" height="17" rx="7" fill="#a85f1e"/></g>
      <!-- chest tan -->
      <path fill="#a85f1e" d="M176 56 Q186 66 182 80 Q172 86 164 80 Q168 64 176 56 Z"/>
      <!-- head -->
      <g class="head">
        <circle cx="196" cy="34" r="25" fill="#15151a"/>
        <path fill="#15151a" d="M196 12 Q226 14 234 34 L232 44 Q220 52 204 50 Z"/>
        <path fill="#a85f1e" d="M210 34 Q228 30 236 38 Q236 48 224 50 Q210 50 206 44 Z"/>
        <ellipse cx="235" cy="38" rx="6" ry="5" fill="#050507"/>
        <path class="tongue" fill="#e86a8a" d="M222 50 Q224 61 218 63 Q212 60 216 50 Z"/>
        <circle cx="202" cy="26" r="3.2" fill="#fff"/>
        <circle cx="203" cy="26.5" r="2" fill="#1f2937"/>
        <circle cx="200" cy="18" r="3" fill="#a85f1e"/>
        <path class="ear" fill="#0c0c10" d="M182 11 Q173 30 184 38 Q194 34 192 17 Z"/>
        <rect x="170" y="49" width="28" height="8" rx="4" fill="#dc2626" transform="rotate(16 184 53)"/>
      </g>
    </g>
  </svg>`;

  const el = document.createElement("div");
  el.id = "rottie";
  el.innerHTML = `<div class="woof">WOOF!</div>${SVG}`;
  document.body.appendChild(el);

  const woof = el.querySelector(".woof");
  let woofTimer;
  el.addEventListener("click", () => {
    woof.classList.add("show");
    clearTimeout(woofTimer);
    woofTimer = setTimeout(() => woof.classList.remove("show"), 1100);
  });

  const RUN_EVERY = 25_000;
  const RUN_MS = 7_000;
  let dir = -1;

  function run() {
    if (document.hidden || el.classList.contains("running")) return;
    dir = -dir;
    const w = el.offsetWidth || 170;
    const from = dir === 1 ? -w - 60 : window.innerWidth + 60;
    const to   = dir === 1 ? window.innerWidth + 60 : -w - 60;
    // flip the artwork only, so the woof bubble text stays readable
    el.querySelector("svg").style.transform = dir === 1 ? "" : "scaleX(-1)";
    el.classList.add("running");
    const anim = el.animate(
      [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }],
      { duration: RUN_MS, easing: "linear" }
    );
    anim.onfinish = () => {
      el.classList.remove("running");
      woof.classList.remove("show");
    };
  }

  setTimeout(run, 3000);
  setInterval(run, RUN_EVERY);
})();
