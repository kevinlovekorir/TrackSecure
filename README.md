# TrackSecure Kenya

Protect. Track. Recover.

## What's in this build

```
tracksecure/
├── frontend/           Website + installable web app (PWA)
│   ├── index.html       Marketing/landing page
│   ├── dashboard.html    Login + device dashboard (map, telemetry, recovery tools)
│   ├── manifest.json      Makes Chrome offer "Install app"
│   ├── sw.js               Service worker (offline caching)
│   ├── css/style.css
│   ├── js/main.js          Theme toggle, install prompt, hero animation
│   ├── js/dashboard.js     Auth flow, Leaflet map, device switching, recovery actions
│   └── icons/
└── backend/            Node + Express + MongoDB API
    ├── server.js
    ├── models/           User, Device, LocationHistory, Command
    ├── routes/           auth, devices, commands
    ├── middleware/auth.js JWT verification
    └── .env.example
```

## Running it locally

**Frontend** — no build step needed, it's static:
```
cd frontend
npx serve .          # or any static file server
```
Open the URL it gives you in Chrome. You'll see an "Install app" button in the
hero and in the install banner — that's the PWA install prompt, and it's what
gives visitors the "download the app" experience you asked for, straight from
Chrome, no app store required. Once installed it opens in its own window, has
its own home-screen icon, and works offline for the pages it's cached.

**Backend**:
```
cd backend
npm install
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm run dev                # or: npm start
```
By default `dashboard.html` calls `http://localhost:5000/api`. To point it at
a deployed backend, set `window.TRACKSECURE_API_BASE` before `js/dashboard.js`
loads, or edit the constant at the top of that file.

The map uses Leaflet + OpenStreetMap tiles rather than Google Maps, since that
needs no API key or billing account to embed — it's a drop-in swap for Google
Maps later if you'd prefer that.

## Adding devices

Click **+ Register a device** in the sidebar. It works two ways depending on whether
the backend is running:

- **Backend reachable** (`npm run dev` in `backend/`, `.env` filled in, MongoDB
  connected): the device is saved to your account via `POST /api/devices`, and
  you get back a `pairingToken` — that's what a future native Android app would
  use to authenticate its background reports for that specific device.
- **Backend not reachable**: the device is still saved, just in that browser's
  `localStorage`, so the dashboard is fully usable standalone with no setup.
  Devices persist across page reloads on the same browser/device.

Either way the new device shows up in the sidebar immediately, becomes the
selected device, and the recovery-tool buttons (ring/lock/wipe/message) work
against whichever mode you're in.

## Important: the "app" you get from Chrome vs. a native Android app


What's built here is a **PWA (Progressive Web App)** — the website itself,
made installable. When someone opens the site in Chrome, Chrome offers to
install it as an app icon on their phone or desktop. That's real and works
today with these files. It's genuinely enough to deliver the dashboard,
login, live map, and recovery-tool buttons as an "app."

It is **not** enough for the features that need direct OS-level access on the
*tracked* phone, specifically:

- **Background location reporting** while the app is closed
- **SIM-change detection**
- **Remote lock / remote wipe** (Android Device Admin / Device Policy Controller APIs)
- **Overriding silent mode to force a ring**

Browsers deliberately don't expose these to web pages — no PWA, on any
platform, can do them. They require a **native Android app** (Kotlin/Java,
built with Android Studio) using Android's location, Device Admin, and
Firebase Cloud Messaging APIs, or a cross-platform wrapper like
**Capacitor** or **React Native** around this same web dashboard.

I can scaffold that native Android project's source code (Kotlin, the
Device Admin receiver, background location service, FCM listener hitting the
`/report` and `/pending-commands` endpoints already built here) — but I can't
compile or test an actual `.apk` in this environment, since that needs the
Android SDK and Gradle's Google Maven repo, which aren't reachable from here.
Just say the word and I'll generate that source tree next.

## API summary

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | Create an owner account |
| POST | `/api/auth/login` | — | Log in, get a JWT |
| POST | `/api/devices` | JWT | Register a device |
| GET | `/api/devices` | JWT | List your devices |
| GET | `/api/devices/:id` | JWT | Device detail + location history |
| POST | `/api/devices/:id/lost` | JWT | Mark a device as lost |
| POST | `/api/devices/:id/report` | pairing token | Device reports its own status |
| POST | `/api/devices/:id/commands` | JWT | Issue ring/lock/wipe/message |
| GET | `/api/devices/:id/pending-commands` | pairing token | Device polls for commands |
| POST | `/api/commands/:id/ack` | pairing token | Device confirms it executed a command |
