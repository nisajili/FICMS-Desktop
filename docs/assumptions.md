# Technical assumptions & limitations

This document records reasonable technical assumptions made during
implementation. They are decisions, not placeholders; adjust them with a
reviewed change if your clinic's constraints differ.

## Storage & database

- **SQLite (sql.js, WASM)** is the default engine for desktop/standalone and
  for tests. It requires no native binaries and persists atomically
  (write-to-temp + rename). It is a single-writer engine — appropriate for one
  desktop process or a lightly-loaded LAN server.
- **PostgreSQL** (`pg`, pure JS) is the recommended engine for connected/on-premise
  server deployments with multiple writers and higher concurrency.
- There is **no Prisma** in the runtime. Repositories are hand-written SQL over
  a small `SqlEngine` abstraction, with camelCase aliases to keep rows typed.
  This avoids Prisma's engine binary and `node-gyp` in Electron.

## Encryption & secrets

- Field-level PII encryption uses a per-install key. In standalone mode the key
  is generated on first boot and stored in the OS-protected user data dir; in
  server modes it should be supplied via `FICMS_FIELD_ENC_KEY`.
- The standalone app secret (`FICMS_APP_SECRET`) is generated per install
  (`userData/secure/app-secret`, mode `0600`). Server modes must set it
  explicitly.

## Concurrency & queues

- Redis/BullMQ is used **when available** (`FICMS_REDIS_ENABLED=true`). When
  Redis is absent, the worker and API degrade to an **in-memory queue fallback**,
  which is sufficient for standalone and small LAN deployments but is not
  durable across restarts. Use Redis for production background jobs.

## Auto-update & packaging

- Electron binaries are downloaded at install time; on restricted networks use
  `ELECTRON_SKIP_BINARY_DOWNLOAD=1` and run packaging on the native-OS CI
  runners.
- No code-signing certificates, production credentials, or external service
  access are committed. Signing and hosting (update feed, S3 bucket, etc.) are
  deployment responsibilities.

## Clinical safety

- The system **never autonomously diagnoses or treats**. All clinical decisions
  require authorized clinical sign-off.
- Signed clinical records are **never hard-deleted or silently overwritten**;
  corrections append and are audited.
- Identity-sensitive lab events require **double-witness verification** by two
  distinct users.

## Compliance

- FICMS ships technical controls (audit logging, access control, encryption,
  witness verification, backup/restore) but **does not constitute** a
  regulatory approval. HIPAA/GDPR/ISO 27001/local-fertility-law compliance
  depends on how the deploying clinic configures, hosts, and operates it.

## Assumptions with functional impact

- Patient MRN numbering is clinic-configurable (prefix + counter); the seeded
  demo uses `MRN-` + zero-padded counter.
- The seeded demo admin (`admin` / `ChangeMe123!`) is **development-only** and
  forces a password change on first login.
- Currency/locale/timezone come from clinic settings (seeded defaults are
  Tanzanian as a neutral example — nothing is hard-coded for any one clinic).
- Documents/attachments default to local disk storage; S3-compatible storage is
  selected via `FICMS_STORAGE_DRIVER=s3`.
