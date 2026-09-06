# Getting started (development)

## Prerequisites

- Node.js ≥ 20.11 (tested on Node 22)
- pnpm ≥ 9 (via Corepack, pinned to 9.15.9 in `package.json`)
- No native toolchain is required for the core (no `node-gyp`, no Prisma engine).
- The Electron binary is only needed to run the packaged desktop shell; the
  renderer can be developed in a plain browser against a local API.

## Install & build

```bash
corepack enable
corepack pnpm install
corepack pnpm -r build          # builds all packages + apps
```

On headless CI (or anywhere the Electron binary download is undesirable):

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 corepack pnpm install
```

## Run the API

```bash
FICMS_SEED=true \
FICMS_HOST=0.0.0.0 FICMS_PORT=4123 \
FICMS_APP_SECRET=dev-secret-change-me \
DATABASE_URL=file:.ficms-data/api.db \
node apps/api/dist/main.js
```

- `FICMS_SEED=true` seeds roles, the demo admin, clinic defaults, and a
  synthetic demo patient on a fresh database (idempotent).
- Swagger UI: `http://127.0.0.1:4123/docs` — spec at `/docs-json`.
- Health: `GET /api/v1/health/ready`.

### Seed login

| Field | Value |
|---|---|
| Username | `admin` |
| Password | `ChangeMe123!` |
| Role | `SYSTEM_ADMINISTRATOR` |
| First login | must change password (`mustChangePassword: true`) |

## Run the desktop renderer (browser preview)

```bash
corepack pnpm --filter @ficms/desktop dev
```

Vite serves the renderer and proxies `/api` to `http://127.0.0.1:4123`, so the
UI works against the locally running API. In the browser the token stays in
memory only (no OS keychain).

## Run the desktop app (Electron)

```bash
corepack pnpm --filter @ficms/desktop dev:electron
```

By default this launches **standalone mode** (embedded backend). Set
`FICMS_DESKTOP_MODE=lan` / `connected` and `FICMS_DESKTOP_BACKEND_URL` to point
at a remote server. See [`docs/deployment.md`](deployment.md).

## Run the background worker

```bash
DATABASE_URL=file:.ficms-data/api.db \
FICMS_REDIS_ENABLED=false \
node apps/worker/dist/main.js
```

## Database tooling

```bash
corepack pnpm db:migrate          # apply pending migrations
corepack pnpm db:migrate:status   # list migration status
corepack pnpm db:seed             # seed roles/admin/defaults
```

## Verification

```bash
corepack pnpm -r typecheck
corepack pnpm -r lint
corepack pnpm -r test             # config, domain, security, database, api
corepack pnpm --filter @ficms/api run test:e2e
```

## Common issues

- **`sh: pnpm: not found`** — this environment has no global `pnpm`; use
  `corepack pnpm <cmd>`.
- **`Cannot find module '@ficms/…'` while building the API** — build the shared
  packages first (`corepack pnpm -r --filter './packages/**' build`), or run the
  aggregate build above.
- **Electron binary download fails** — set `ELECTRON_SKIP_BINARY_DOWNLOAD=1`
  (the renderer + typecheck + lint still work; packaging runs on CI).
