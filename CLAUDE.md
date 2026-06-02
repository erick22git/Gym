# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install          # Install dependencies
npm run dev          # Start both Vite dev server + Electron (concurrently)
npm run build        # Production build (Vite + electron-builder) → dist-electron/
npm run build:vite   # Vite build only
npm run preview      # Preview Vite build
```

## Architecture

Electron + React + Vite + SQLite desktop app. Fully offline.

**Process separation:**
- `electron/main.cjs` — Main process: creates BrowserWindow, registers all IPC handlers, loads Vite dev server (dev) or `dist/index.html` (prod)
- `electron/preload.cjs` — Bridges main/renderer via `contextBridge`, exposes `window.api`
- `electron/database.cjs` — All SQLite logic using `sql.js` (WASM). DB is **in-memory**: loaded from disk on `initDB()` (async), flushed to disk via `saveDB()` on every mutation and on `before-quit`

**DB location:** `dev_data/urbanfitness.db` (dev) / `%APPDATA%\urban-fitness-club\urbanfitness.db` (prod). Default admin password: `1234`.

**Renderer (React/Vite):**
- `src/App.jsx` — Root: renders TitleBar + Sidebar + page content + AdminModal; page transitions use framer-motion
- `src/context/AppContext.jsx` — Single global context (`useApp()`): `page`, `isAdmin`, `navigate()`, `unlockAdmin()`, `lockAdmin()`
- `src/constants.js` — `PAGES` enum and `ADMIN_PAGES` list (all pages except `attendance` and `alerts`)
- `src/pages/` — One component per module (English names: `Attendance`, `Clients`, `Memberships`, `Dashboard`, `AttendanceLog`, `Alerts`, `Income`, `Settings`)
- `src/components/ui/` — `Modal`, `StatCard`, `StatusBadge`, `SearchInput`, `ClientAvatar`
- `src/components/layout/` — `Sidebar`, `PageHeader`
- `src/components/charts/` — `IncomeChart`

**Admin gating:** Navigating to any page in `ADMIN_PAGES` triggers password prompt if `!isAdmin`. `Attendance` and `Alerts` are always public. Admin session lives in React state — cleared on app restart or by clicking "ADMIN · CERRAR SESIÓN" in TitleBar.

## Key patterns

- All IPC calls are async: `await window.api.clientes.getAll()`
- `sql.js` DB is **in-memory** — `saveDB()` is called inside the `run()` helper after every INSERT/UPDATE/DELETE, so the file is always up to date
- `initDB()` is **async** (loads WASM); `main.cjs` awaits it before creating the window
- Custom frameless window: `frame: false` in BrowserWindow; title bar buttons call `window.api.minimize/maximize/close`
- CSS uses Tailwind + custom `gym-*` / `btn-*` / `titulo-metalico` classes defined in `src/index.css`
- Page routing is local state in `AppContext` — no React Router

## Adding a new feature

1. Add DB methods to `electron/database.cjs`
2. Register `ipcMain.handle('feature:method', ...)` in `electron/main.cjs`
3. Expose via `contextBridge` in `electron/preload.cjs` under `window.api.feature`
4. Create `src/pages/Feature.jsx`, add to `PAGES` / `ADMIN_PAGES` in `src/constants.js`, and add to `PAGE_COMPONENTS` in `src/App.jsx`
