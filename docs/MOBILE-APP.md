# Mobile install — PWA & native apps (same Render database)

Attendify is a **web app** (HTML + `server.js` + SQLite on Render). Phones should **not** run a separate database. Use one of these options.

---

## Recommended path

| Goal | Approach |
|------|----------|
| Fast install for students / TAs | **PWA** — Add to Home Screen / Install app |
| Play Store / App Store listing | **Capacitor** — native shell loading your **Render URL** |
| Shared data | Always one **Render Web Service** + **persistent disk** (`/var/data`) |

**Do not use Firestore** for this stack unless you rewrite the backend. The app talks to `/api/*` on your Node server.

---

## 1. PWA (Android & iOS, no store)

Works today after deploy:

1. Deploy to Render with HTTPS.
2. On the phone, open `https://YOUR-SERVICE.onrender.com/splash.html`
3. **Android (Chrome):** Menu → **Install app** or use `/install.html`
4. **iPhone (Safari):** Share → **Add to Home Screen**

**What it does**

- `manifest.webmanifest` — standalone app icon, opens splash → mobile login flow
- `sw.js` — caches CSS/JS/icons so the UI loads faster after the first visit
- **API calls still go to Render** — same database as desktop

Optional env on Render:

```env
ATTENDIFY_PUBLIC_ORIGIN=https://YOUR-SERVICE.onrender.com
```

---

## 2. Capacitor — Android APK / iOS IPA (store-ready)

Capacitor wraps a WebView that loads your **live Render site**. No duplicate API or DB.

### Prerequisites

- Node 18+
- **Android:** Android Studio
- **iOS:** macOS + Xcode (required for App Store)

### One-time setup

```bash
npm install
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios

# Point the app at your Render URL
set ATTENDIFY_PUBLIC_ORIGIN=https://YOUR-SERVICE.onrender.com
node scripts/set-capacitor-server.js

npx cap add android
npx cap add ios
npx cap sync
```

### Open and run

```bash
npx cap open android
npx cap open ios
```

Build release APK/AAB or IPA from Android Studio / Xcode.

### After you change the Render URL

```bash
node scripts/set-capacitor-server.js https://NEW.onrender.com
npx cap sync
```

---

## 3. Render settings (shared database)

Keep **one** web service:

| Setting | Value |
|---------|--------|
| Start command | `npm start` |
| Instances | **1** (SQLite) |
| Disk | Mount `/var/data`, set `ATTENDIFY_DB_PATH=/var/data/attendify.db` |

PWA and Capacitor users both hit this same service.

---

## 4. Speed on phones

Render free tier can be slow on **cold start**. PWA caching helps **static files** (CSS/JS); first API call may still wake the server.

Mitigations:

- Persistent disk (so login survives deploys)
- PWA install (faster repeat visits)
- Optional Render **paid** plan to reduce sleep
- Optional custom domain + keep-alive (institution policy)

---

## 5. Which screens are “mobile app”?

Mobile flow matches existing UI:

- `splash.html` → `login.html` (auth mobile layout)
- `enroll.html` — student registration
- `ta-scanner.html` — shared scanner
- `dashboard.html` / `course.html` — lecturer (responsive)

`start_url` in the manifest is `/splash.html?from=pwa`.

---

## 6. Icons & branding

Replace files in `/icons/` (`icon-192.svg`, `icon-512.svg`, `icon-maskable.svg`) with your institution artwork if needed.