// Point this at your deployed backend. Leave as-is for local dev with the
// included Express server (see backend/README.md).
const API_BASE = window.TRACKSECURE_API_BASE || "http://localhost:5000/api";
const STORAGE_KEY = "ts-devices";

const DEFAULT_DEVICES = {
  pixel:  { name: "Kevin's Pixel 8",        imei: "•• 4471", model: "Google Pixel 8", android: "14", batt: 82, charge: false, lat: -1.2921, lng: 36.8219, online: true },
  galaxy: { name: "Sharon's Galaxy A14",     imei: "•• 8820", model: "Samsung Galaxy A14", android: "13", batt: 54, charge: true,  lat: -0.0917, lng: 34.7680, online: true },
  redmi:  { name: "Office Redmi Note 12",    imei: "•• 1103", model: "Xiaomi Redmi Note 12", android: "12", batt: 0,  charge: false, lat: -1.0333, lng: 37.0693, online: false }
};

// ---------------- Device store (persisted per-browser; synced to the API when reachable) ----------------
function loadDevices() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.warn("Could not read stored devices, reseeding defaults:", err.message);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DEVICES));
  return { ...DEFAULT_DEVICES };
}

function saveDevices() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
}

let devices = loadDevices();
let activeDevice = Object.keys(devices)[0] || null;
let map, marker;

// ---------------- Toast ----------------
function toast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2600);
}

// ---------------- Auth overlay ----------------
(function () {
  const overlay = document.getElementById("authOverlay");
  const form = document.getElementById("authForm");
  const title = document.getElementById("authTitle");
  const sub = document.getElementById("authSub");
  const submit = document.getElementById("authSubmit");
  const switchText = document.getElementById("switchText");
  const switchLink = document.getElementById("switchLink");
  const nameField = document.getElementById("nameField");
  const errorEl = document.getElementById("authError");
  let mode = "login";

  function render() {
    if (mode === "login") {
      title.textContent = "Log in to TrackSecure";
      sub.textContent = "Access your private device dashboard.";
      submit.textContent = "Log in";
      switchText.textContent = "Don't have an account?";
      switchLink.textContent = "Create one";
      nameField.style.display = "none";
    } else {
      title.textContent = "Create your account";
      sub.textContent = "Register to start protecting your devices.";
      submit.textContent = "Create account";
      switchText.textContent = "Already have an account?";
      switchLink.textContent = "Log in";
      nameField.style.display = "block";
    }
    errorEl.style.display = "none";
  }

  switchLink.addEventListener("click", (e) => {
    e.preventDefault();
    mode = mode === "login" ? "register" : "login";
    render();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.style.display = "none";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const fullName = document.getElementById("fullName").value.trim();
    const endpoint = mode === "login" ? "/auth/login" : "/auth/register";

    try {
      const res = await fetch(API_BASE + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "login" ? { email, password } : { email, password, fullName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Something went wrong");
      localStorage.setItem("ts-token", data.token);
      dismissAuth();
    } catch (err) {
      // Backend not reachable — fall through to demo mode so the UI is still explorable.
      console.warn("Auth API unreachable, continuing in demo mode:", err.message);
      dismissAuth();
    }
  });

  // Skip the gate entirely if a token already exists.
  if (localStorage.getItem("ts-token")) dismissAuth();

  function dismissAuth() {
    overlay.style.display = "none";
    document.getElementById("appShell")?.classList.remove("hidden");
    // Leaflet renders incorrectly if initialized while its container was display:none,
    // so the map is (re)shown only now that the dashboard is actually visible.
    if (typeof onDashboardVisible === "function") onDashboardVisible();
  }

  render();
})();

document.getElementById("logoutBtn")?.addEventListener("click", () => {
  localStorage.removeItem("ts-token");
  location.reload();
});

// ---------------- Map ----------------
function initMap(device) {
  if (!map) {
    map = L.map("map", { zoomControl: true, attributionControl: true }).setView([device.lat, device.lng], 14);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19
    }).addTo(map);
    marker = L.marker([device.lat, device.lng]).addTo(map);
  } else {
    map.setView([device.lat, device.lng], 14);
    marker.setLatLng([device.lat, device.lng]);
  }
}

// ---------------- Sidebar list ----------------
function renderSidebar() {
  const list = document.getElementById("deviceList");
  const keys = Object.keys(devices);

  if (keys.length === 0) {
    list.innerHTML = `<div class="device-empty">No devices yet — register one below.</div>`;
    return;
  }

  list.innerHTML = keys
    .map((key) => {
      const d = devices[key];
      const color = d.online ? "var(--signal)" : "var(--danger)";
      const activeClass = key === activeDevice ? " active" : "";
      return `<div class="device-item${activeClass}" data-device="${key}">
                <span class="dot" style="color:${color}"></span> ${escapeHtml(d.name)}
              </div>`;
    })
    .join("");

  list.querySelectorAll(".device-item").forEach((el) => {
    el.addEventListener("click", () => renderDevice(el.dataset.device));
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

// ---------------- Device switching ----------------
function renderDevice(key) {
  const d = devices[key];
  if (!d) return;
  activeDevice = key;
  document.getElementById("deviceTitle").textContent = d.name;
  document.getElementById("deviceSub").innerHTML = `IMEI ${d.imei || "— not set"} · Android ${d.android || "—"} · last sync <span id="lastSync">${d.online ? "just now" : "3h ago"}</span>`;
  document.getElementById("statBatt").textContent = d.online ? `${d.batt}%` : "—";
  document.getElementById("statCharge").textContent = d.charge ? "Yes" : "No";
  document.querySelectorAll(".device-item").forEach((el) => el.classList.toggle("active", el.dataset.device === key));
  initMap(d);
}

// ---------------- Add-device modal ----------------
(function () {
  const overlay = document.getElementById("deviceModalOverlay");
  const openBtn = document.getElementById("addDeviceBtn");
  const cancelBtn = document.getElementById("deviceModalCancel");
  const form = document.getElementById("deviceForm");
  const note = document.getElementById("deviceModalNote");

  function open() {
    overlay.classList.add("open");
    document.getElementById("devName").focus();
  }
  function close() {
    overlay.classList.remove("open");
    form.reset();
  }

  openBtn?.addEventListener("click", open);
  cancelBtn?.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay.classList.contains("open")) close(); });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("devName").value.trim();
    const phoneNumber = document.getElementById("devPhone").value.trim();
    const model = document.getElementById("devModel").value.trim();
    const imei = document.getElementById("devImei").value.trim();
    if (!name) return;

    const key = slugify(name);
    const newDevice = {
      name, model, imei: imei || "— not set", android: "—",
      batt: 100, charge: false, online: false,
      // Nairobi as a sensible default centre until the app reports a real fix.
      lat: -1.2921 + (Math.random() - 0.5) * 0.05,
      lng: 36.8219 + (Math.random() - 0.5) * 0.05
    };

    const token = localStorage.getItem("ts-token");
    let pairingToken = null;

    try {
      const res = await fetch(`${API_BASE}/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name, phoneNumber, imei, model })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Registration failed");
      pairingToken = data.device?.pairingToken;
      note.textContent = "// registered on the backend";
    } catch (err) {
      console.warn("Backend unreachable — device saved locally in this browser only.", err.message);
      note.textContent = "// backend unreachable — saved locally in this browser for now";
    }

    devices[key] = newDevice;
    saveDevices();
    renderSidebar();
    renderDevice(key);
    close();

    addLog(`Registered new device — ${name}`);
    toast(pairingToken ? `${name} registered · pairing code ready` : `${name} added to this browser`);
  });

  function slugify(str) {
    const base = str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "device";
    let key = base, i = 1;
    while (devices[key]) key = `${base}-${++i}`;
    return key;
  }
})();

// ---------------- Recovery tool actions ----------------
function addLog(text) {
  const list = document.getElementById("logList");
  const item = document.createElement("div");
  item.className = "log-item";
  item.innerHTML = `<span>${escapeHtml(text)}</span><span class="log-time">just now</span>`;
  list.prepend(item);
}

async function sendCommand(action) {
  const token = localStorage.getItem("ts-token");
  try {
    const res = await fetch(`${API_BASE}/devices/${activeDevice}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action })
    });
    if (!res.ok) throw new Error("Command failed");
    return true;
  } catch (err) {
    console.warn(`Backend unreachable — "${action}" simulated locally.`, err.message);
    return false;
  }
}

document.querySelectorAll(".tool-btn").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (!activeDevice) { toast("Register a device first"); return; }
    const action = btn.dataset.action;
    const labels = {
      ring: "Ring command sent",
      message: "Lock-screen message updated",
      lock: "Device lock command sent",
      wipe: "Remote wipe requested — confirm to proceed"
    };
    if (action === "wipe" && !confirm("This will erase all data on the device. Continue?")) return;
    await sendCommand(action);
    addLog(`${labels[action]} — ${devices[activeDevice].name}`);
    toast(labels[action]);
  });
});

// ---------------- Init ----------------
// Runs the first time the dashboard becomes visible (called from dismissAuth() above).
// Guards against Leaflet initializing inside a display:none container.
let dashboardInitialized = false;
function onDashboardVisible() {
  if (dashboardInitialized) {
    map && map.invalidateSize();
    return;
  }
  dashboardInitialized = true;
  renderSidebar();
  if (activeDevice) renderDevice(activeDevice);
}
