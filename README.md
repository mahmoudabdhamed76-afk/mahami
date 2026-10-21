# مهامي — Mahami Smart Task Manager

A premium, Arabic-first (RTL) task manager with an iOS "Liquid Glass" interface, real-time multi-device sync and full offline support.

**Stack:** Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · Node.js REST API (Next route handlers) · PostgreSQL · Prisma 7 (pg driver adapter) · IndexedDB · Service Worker · Web Push · Server-Sent Events.

---

## Quick start

### Windows (zero setup)
Double-click **`start-windows.bat`**. It installs dependencies, starts a bundled local PostgreSQL (no install needed, data in `.pgdata/`), migrates, builds and opens http://localhost:3000.

### Any OS, with your own PostgreSQL
```bash
npm install
cp .env.example .env          # set DATABASE_URL
npm run setup                 # prisma generate + migrations
npm run dev                   # http://localhost:3000   (or: npm run build && npm start)
```
No PostgreSQL? `npm install --no-save embedded-postgres && npm run db:local` starts an embedded one on port 5433:
`DATABASE_URL="postgresql://mahami:mahami@localhost:5433/mahami"`.

### Docker
```bash
docker compose up -d          # app + postgres → http://localhost:3000
```

### Railway
1. Create a project, add the **PostgreSQL** plugin.
2. Deploy this repo (uses `Dockerfile` + `railway.json`, health check `/api/health`).
3. Set `DATABASE_URL` to the plugin's reference variable. Migrations run automatically on start.
4. Optional: `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (`npm run vapid`), `VAPID_SUBJECT`. If omitted, keys are generated once and stored in the database.

> Web Push and the service worker require HTTPS (or `localhost`). On iPhone, notifications work after "Add to Home Screen" (iOS 16.4+).

---

## Features

| Area | What you get |
|---|---|
| Tasks | Create / edit / delete with undo, priorities, lists (categories with color + icon), due date & time, notes, subtasks with progress |
| Smart quick add | Arabic natural language (MSA + Egyptian): `اجتماع بكرة الساعة 5 !عالية #العمل ذكرني` → tomorrow 5 PM, high priority, list "العمل", reminder |
| Views | Today (progress ring), smart lists (Today, Scheduled, All, Important, Overdue, Completed), per-list view with sort/filter, Calendar **day** (hour timeline) / **week** (agenda) / **month** (grid) |
| Search | Instant, offline, Arabic-normalized (أ/إ/آ، ة/ه، ى/ي، تشكيل) with smart filters: `متأخرة` `اليوم` `بكره` `مكتملة` `بدون موعد` `!عالية` `#القائمة` |
| Reminders | Server-side scheduler + Web Push (with "تم ✓" and "snooze 10 min" actions), in-app banners/chime, auto-reminder defaults |
| Calendar | Private iCalendar subscription feed (Google / Apple / Outlook), per-task `.ics` export and Google Calendar link |
| Stats | Weekly completion, streaks, 7/30-day chart, 12-week heatmap, per-list progress, priority mix, insights |
| Sync | Instant multi-device sync over SSE + Postgres LISTEN/NOTIFY; offline-first with IndexedDB outbox |
| UX | iOS liquid glass, large collapsing titles, push/pop transitions, swipe actions (← complete, → delete), sheets with drag-to-dismiss, haptics, light/dark/auto, 7 accent colors, Arabic or Latin digits, keyboard shortcuts (`N`, `/`, `1-5`) |
| Security | scrypt password hashing, httpOnly SameSite cookies with hashed session tokens, sliding expiry, logout everywhere, rate limiting, Origin checks (CSRF), CSP & security headers, per-user data isolation |

---

## Architecture

```
src/
  app/                 Next.js app (single client shell at "/") + REST API in app/api/*
  server/              db (Prisma), auth, sync engine, realtime hub, push, reminder scheduler, ics
  client/              IndexedDB, Zustand store, sync engine, actions, NLP, search, notifications
  components/          UI (views, tasks, glass primitives, navigation)
  lib/                 types + zod schemas shared by client and server
prisma/                schema + SQL migrations (incl. sync triggers)
public/sw.js           offline shell cache, push handling, notification actions
scripts/               migrate (engine-free), local-db, vapid, smoke test
```

### Sync protocol
* Every syncable row (`Category`, `Task`, `Subtask`) has a `version` assigned by a Postgres trigger from a global sequence. The trigger first takes a **per-user transaction advisory lock**, so a user's versions become visible strictly in commit order → `GET /api/sync/pull?since=<cursor>` is gap-free.
* Deletes are soft (tombstones) so they propagate to every device.
* Clients write locally first (IndexedDB + outbox), then `POST /api/sync/push`. Conflicts resolve **last-write-wins** using the client timestamp, corrected for device clock skew.
* After each write, the trigger `NOTIFY`s the user id; one `LISTEN` connection per server instance fans out to that user's SSE streams, which tell other devices to pull. Works across multiple instances.

### REST API (JSON, cookie session)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` · `/api/auth/login` · `/api/auth/logout` (`{all:true}` for every device) | Sessions |
| GET/PATCH/DELETE | `/api/auth/me` | Profile & settings / delete account |
| POST | `/api/auth/password` | Change password |
| GET/POST | `/api/tasks` (filters: `status`, `q`, `categoryId`, `priority`, `from`, `to`, `limit`, `offset`) | List / create (with `subtasks`) |
| GET/PATCH/DELETE | `/api/tasks/:id` | Read / update / delete |
| POST | `/api/tasks/:id/action` `{action:"complete"|"snooze"}` | Quick actions |
| GET/POST, PATCH/DELETE | `/api/categories`, `/api/categories/:id` | Lists |
| POST, GET | `/api/sync/push`, `/api/sync/pull?since=` | Offline sync |
| GET | `/api/sync/stream` | Real-time SSE |
| GET/POST/DELETE, POST | `/api/push`, `/api/push/test` | Web Push |
| GET, POST | `/api/calendar/:token.ics`, `/api/calendar/token` | iCal feed / rotate link |
| GET | `/api/health` | Health check |

### Scripts
| Command | |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run setup` | `prisma generate` + migrations |
| `npm run db:migrate` | Apply migrations (engine-free runner, compatible with `prisma migrate deploy`) |
| `npm run db:local` | Embedded PostgreSQL on :5433 |
| `npm run test:api` | 30+ end-to-end API checks against a running server |
| `npm run vapid` | Generate Web Push keys |

Environment: see `.env.example`. `REMINDER_INTERVAL_MS=0` disables the scheduler on an instance.
