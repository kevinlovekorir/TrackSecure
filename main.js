// ---------- Theme toggle ----------
(function () {
  const root = document.documentElement;
  const saved = localStorage.getItem("ts-theme"); // fine for a static demo site (not an in-chat artifact)
  if (saved) root.setAttribute("data-theme", saved);

  const toggle = document.getElementById("themeToggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      root.setAttribute("data-theme", next);
      localStorage.setItem("ts-theme", next);
    });
  }
})();

// ---------- Fake live telemetry on the hero radar card ----------
(function () {
  const battEl = document.getElementById("batt");
  const syncEl = document.getElementById("sync");
  const latEl = document.getElementById("lat");
  if (!battEl) return;

  let battery = 74;
  let seconds = 2;
  const baseLat = -0.6817, baseLng = 35.2891;

  setInterval(() => {
    seconds += 2;
    syncEl.textContent = seconds > 58 ? "just now" : `${seconds}s ago`;
    if (seconds > 58) seconds = 0;

    if (Math.random() > 0.7 && battery > 1) battery -= 1;
    battEl.textContent = `${battery}%`;

    const jLat = (baseLat + (Math.random() - 0.5) * 0.0006).toFixed(4);
    const jLng = (baseLng + (Math.random() - 0.5) * 0.0006).toFixed(4);
    latEl.textContent = `${jLat}° , ${jLng}°`;
  }, 2000);
})();

// ---------- Register service worker ----------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

// ---------- PWA install prompt ----------
(function () {
  let deferredPrompt = null;
  const installBtn = document.getElementById("installBtn");
  const hint = document.getElementById("installHint");

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (installBtn) installBtn.hidden = false;
  });

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) {
        if (hint) {
          hint.textContent = /iphone|ipad|ipod/i.test(navigator.userAgent)
            ? "// on iPhone: tap Share, then \"Add to Home Screen\""
            : "// open the browser menu and choose \"Install app\" or \"Add to Home screen\"";
        }
        return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (hint) hint.textContent = outcome === "accepted" ? "// installed — check your home screen" : "// install cancelled";
      deferredPrompt = null;
    });
  }

  window.addEventListener("appinstalled", () => {
    if (hint) hint.textContent = "// TrackSecure is installed";
  });
})();
