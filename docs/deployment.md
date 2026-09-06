# Deployment — the three operating modes

FICMS ships one desktop application that runs in one of three modes. Mode is
resolved at launch (`apps/desktop/electron/backend.ts` → `resolveMode()`):

1. explicit `FICMS_DESKTOP_MODE` (`standalone` | `lan` | `connected`),
2. otherwise `FICMS_DESKTOP_BACKEND_URL` set → `lan`,
3. otherwise `standalone`.

---

## 1. Standalone Desktop Mode

The app embeds the FICMS API and runs everything locally.

- The backend is forked as a child process and bound to **`127.0.0.1` only** on
  an **ephemeral port** — nothing is exposed beyond the machine.
- On first run it seeds roles/admin and creates a **per-install app secret**
  (`userData/secure/app-secret`, mode `0600`).
- Data lives under `userData/data/`:
  - `ficms.db` (SQLite), `storage/` (documents/attachments),
  - backups under `userData/backups/`.
- Redis is disabled; the job queue uses the in-memory fallback.
- Field-level encryption uses a per-install key; PII is encrypted at rest.

**Launch**: run the installed app (default) or
`FICMS_DESKTOP_MODE=standalone corepack pnpm --filter @ficms/desktop dev:electron`.

**Safety**: there is no unauthenticated local API surface; every request still
authenticates against the embedded server using the same auth flow as the other
modes.

---

## 2. On-Premise LAN Mode

The desktop app connects to a self-hosted FICMS API on the clinic's private
network.

- Deploy the API (and optional worker) on a clinic server:
  ```bash
  FICMS_SEED=true \
  FICMS_HOST=0.0.0.0 FICMS_PORT=4123 \
  FICMS_APP_SECRET=<strong random secret> \
  DATABASE_URL=file:/var/lib/ficms/ficms.db \      # or postgresql://…
  node apps/api/dist/main.js
  ```
- Point workstations at it:
  ```bash
  FICMS_DESKTOP_MODE=lan \
  FICMS_DESKTOP_BACKEND_URL=http://<server>:4123/api/v1 \
  <launch FICMS>
  ```
- Recommended: terminate TLS at a reverse proxy even on the LAN, restrict
  access with firewall rules, and enable Redis/BullMQ for the worker.

---

## 3. Connected Clinic Mode (HTTPS)

The desktop app connects to a hosted FICMS API over the public internet.

- Deploy the API behind an HTTPS reverse proxy with a valid certificate.
- Configure the workstation:
  ```bash
  FICMS_DESKTOP_MODE=connected \
  FICMS_DESKTOP_BACKEND_URL=https://ficms.example.com/api/v1 \
  <launch FICMS>
  ```
- Use a **strong `FICMS_APP_SECRET`**, PostgreSQL as the database, S3-compatible
  object storage (`FICMS_STORAGE_DRIVER=s3`), and Redis for the queue.
- The desktop app performs no certificate bypass; `webSecurity` is enabled and
  navigation is restricted.

---

## Environment reference

Configuration is mapped from environment variables in
`packages/config/src/env.ts` and validated by `packages/config/src/schema.ts`.
Common variables:

| Variable | Purpose |
|---|---|
| `FICMS_HOST` / `FICMS_PORT` | API bind address/port |
| `FICMS_APP_SECRET` | signing secret for tokens (required in server modes) |
| `DATABASE_URL` | `file:…` (SQLite) or `postgresql://…` (PostgreSQL) |
| `FICMS_FIELD_ENC_KEY` | optional explicit field-encryption key (auto-generated otherwise) |
| `FICMS_REDIS_ENABLED` / `FICMS_REDIS_URL` | Redis/BullMQ |
| `FICMS_QUEUE_ENABLED` | enable job queue (in-memory fallback when no Redis) |
| `FICMS_STORAGE_DRIVER` | `local` or `s3` |
| `FICMS_S3_ENDPOINT/REGION/BUCKET/ACCESS_KEY/SECRET_KEY` | S3-compatible storage |
| `FICMS_SESSION_TTL` | session lifetime (seconds) |
| `FICMS_IDLE_LOCK` | idle auto-lock (seconds) |
| `FICMS_STANDALONE` / `FICMS_STANDALONE_DATA_DIR` | standalone overrides (set by the desktop app) |

See `packages/config/src/env.ts` for the complete mapping.
