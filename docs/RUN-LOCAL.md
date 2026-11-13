# Run Attendify on localhost

The faculty app runs at **http://localhost:3000/** (port **3000**, same style as many dev servers).

## Quick start (keeps running)

**Background (recommended):**

```powershell
npm run serve:bg
```

**Foreground (see logs):**

```powershell
npm run serve
```

Or double-click `start-attendify.cmd`.

## npm scripts

| Command | What it does |
|--------|----------------|
| `npm start` | Run once (stops when the terminal closes) |
| `npm run serve` | Auto-restart loop (foreground) |
| `npm run serve:bg` | Auto-restart in a minimized window |
| `npm run serve:stop` | Stop whatever is on port 3000 |

## URLs

| URL | Page |
|-----|------|
| http://localhost:3000/ | Dashboard |
| http://localhost:3000/dashboard.html | Dashboard |
| http://localhost:3000/programme.html?programme=… | Programme registration & roster |
| http://localhost:3000/enroll.html?class=… | Student self-registration (per programme) |
| http://localhost:3000/course.html | Course detail |

## Start at Windows sign-in (optional)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\register-attendify-startup.ps1
```

## NestJS Phase 1 API (PostgreSQL)

The separate API also defaults to port **3000**. Run **only one** server on 3000 at a time.

- **Faculty HTML app (SQLite):** `npm run serve:bg` → http://localhost:3000/
- **Nest API:** set another port, e.g. `$env:PORT = "3001"; npm run api:dev`

## Custom port

```powershell
$env:ATTENDIFY_PORT = "8080"
npm start
```
