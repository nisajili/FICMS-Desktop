# Architecture

## High-level overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Desktop app (apps/desktop)                                      │
│  ┌───────────────┐   IPC (contextBridge)   ┌──────────────────┐  │
│  │  Renderer      │ ───────────────────────►│  Main process     │  │
│  │  React/Vite    │   window.ficms only     │  window, vault,  │  │
│  │  (sandboxed)   │ ◄───────────────────────│  backend, update │  │
│  └───────┬───────┘                          └────────┬─────────┘  │
│          │ HTTP /api/v1 (loopback or remote)         │ fork        │
│          ▼                                           ▼             │
│  FICMS API (apps/api, NestJS) ◄───── standalone backend (127.0.0.1)│
└─────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────┐
│  packages/database — repositories over SqlEngine                 │
│     ├─ sql.js (WASM SQLite, atomic snapshot persistence)         │
│     └─ pg (pure-JS PostgreSQL)                                   │
├─────────────────────────────────────────────────────────────────┤
│  packages/domain — business rules (RBAC, witness, numbering)     │
│  packages/security — hashing, TOTP, tokens, cipher               │
│  packages/config — env mapping + validated schema                │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### `apps/api` — NestJS backend

- Versioned REST API under `/api/v1` with a global route prefix.
- Swagger/OpenAPI exposed at `/docs` (UI) and `/docs-json` (spec) in
  non-production builds; the committed spec is [`docs/openapi.json`](openapi.json).
- Request validation with zod schemas; authorization with permission guards.
- Modules: auth, users, patients, clinical (EMR), cycles (ART/IVF/ICSI/IUI),
  laboratory, cryobank, finance, inventory, settings, reports, documents, sync,
  backup, health.
- `bootstrap({ seed?, onListening?, autoListen? })` in `src/main.ts` is reused
  by the standalone desktop backend (`autoListen` / child-process friendly).

### `apps/desktop` — Electron + React/Vite

- **Main process** (`electron/main.ts`): single-instance lock, hardened
  `BrowserWindow`, OS-keychain vault, restricted navigation/permissions,
  backend lifecycle, and secure auto-update.
- **Preload** (`electron/preload.ts`): `contextBridge` exposing a minimal
  `window.ficms` surface (runtime info, keychain, `openExternal`, updater).
- **Renderer** (`src/`): React app (HashRouter) with login, dashboard, patients,
  and settings pages; a typed `api.ts` client with dynamic base resolution
  (`/api/v1` fallback for the browser preview).
- **Standalone backend** (`electron/backend.ts`): forks the compiled API bound
  to `127.0.0.1` on an ephemeral port, with per-install secret, local storage,
  Redis disabled, and in-memory queue fallback.

### `apps/worker` — background worker

- Runs periodic maintenance (session purge, SQLite integrity check).
- Registers a BullMQ worker when Redis is enabled; otherwise runs
  maintenance-only (in-process fallback). Job handlers: `maintenance.run`,
  `backup.run`, `reports.generate`.

### `packages/*` — shared libraries

- **database**: `SqlEngine` abstraction (sql.js + pg), migration runner,
  seed data, and typed repositories (patients, finance, cryobank, clinical,
  cycles, laboratory, inventory, org, sync, users/sessions/roles, audit, hr).
- **domain**: role definitions, permission helpers, double-witness assertion,
  numbering.
- **security**: Argon2-style password hashing (`@noble/hashes`), TOTP, opaque
  session tokens, and an authenticated field cipher.
- **config**: `FICMS_*` environment mapping onto a validated config schema
  (`loadConfigFromEnv`) and `defaultConfig(overrides)` for the embedded
  standalone backend.

## Data flow

1. The renderer calls the typed client (`apps/desktop/src/api.ts`), which
   resolves the backend base URL at runtime.
2. In standalone mode the URL points at the embedded loopback backend; in
   LAN/connected modes at a configured server.
3. The API validates the request (zod) and checks permissions against the
   caller's roles.
4. The service calls a repository; repositories encode clinical invariants
   (e.g. payment idempotency, double-witness, stock guards) at the data layer
   so no path — UI, API, or offline sync — can bypass them.
5. SQLite commits are atomically snapshotted (write-to-temp + rename) with
   foreign-key enforcement re-asserted after every snapshot.

## Database engines

| | sql.js (SQLite) | pg (PostgreSQL) |
|---|---|---|
| Used for | desktop/standalone, tests | server deployments |
| Dependencies | WASM, none native | `pg` (pure JS) |
| Persistence | in-memory + atomic file snapshot | server-managed |
| Backups | `backupTo()` (snapshot export) | `pg_dump` guidance marker |

The migration runner (`packages/database/src/migrate/runner.ts`) applies the
versioned `0001_init` schema to whichever engine is active; the repository
layer is engine-agnostic.

## Modes of operation

See [`docs/deployment.md`](deployment.md) for the full matrix. Mode resolution
lives in `apps/desktop/electron/backend.ts` (`resolveMode()`): an explicit
`FICMS_DESKTOP_MODE` wins, then a `FICMS_DESKTOP_BACKEND_URL` implies LAN,
otherwise standalone.
