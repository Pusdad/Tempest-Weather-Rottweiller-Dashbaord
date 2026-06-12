/* ============================================================
 * Rottie: the real Rottweiler trots across the screen every
 * 25 s. Click him mid-run for a woof. Skipped entirely when
 * the user prefers reduced motion.
 * ============================================================ */

(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const el = document.createElement("div");
  el.id = "rottie";
  el.innerHTML = `
    <div class="woof">WOOF!</div>
    <span class="flip"><img class="dog" src="img/rottie.png" alt="Running Rottweiler"></span>`;
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
    const w = el.offsetWidth || 160;
    const from = dir === 1 ? -w - 60 : window.innerWidth + 60;
    const to   = dir === 1 ? window.innerWidth + 60 : -w - 60;
    // the photo faces right; mirror only the artwork so the woof bubble stays readable
    el.querySelector(".flip").style.transform = dir === 1 ? "" : "scaleX(-1)";
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
