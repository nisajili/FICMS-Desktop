# Security

FICMS treats fertility records as high-sensitivity medical data. The security
posture spans the desktop shell, the API, and the data layer.

## Desktop (Electron)

Configured in `apps/desktop/electron/main.ts`:

- `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`,
  `webSecurity: true`.
- DevTools disabled in packaged builds.
- A minimal `contextBridge` (`window.ficms`) exposes only:
  `runtime`, `keychain.{get,set,delete}`, `openExternal`, and `updater.*`.
  The renderer never receives `ipcRenderer` or Node.js.
- Navigation is restricted (`will-navigate` blocked to non-app origins);
  new windows are denied and http(s) links are handed to the OS browser.
- All session permission requests (camera, mic, notifications, geolocation…)
  are denied.
- Single-instance lock prevents two copies mutating the same local database.

## Authentication & sessions

- Passwords are hashed with Argon2id-style parameters (`@noble/hashes`, pure JS).
- Sessions use **hashed opaque tokens** with rotation; only the hash is stored.
- The **access token is kept in memory** in the renderer and is never written to
  `localStorage`/`sessionStorage`.
- An optional "remember me" stores the session in the **OS credential vault**
  (Electron `safeStorage`, per-user OS-encrypted); if the vault is unavailable,
  the value is kept in memory only.
- Login throttling, account lockout, and idle auto-lock are configurable via
  `FICMS_LOGIN_THROTTLE_*`, `FICMS_ACCOUNT_LOCKOUT_MAX`, `FICMS_IDLE_LOCK`.
- Optional TOTP two-factor authentication is supported.

## Authorization (RBAC/ABAC)

- Every protected route is guarded by a permission check.
- 19 roles ship with a `resource:action` matrix (see
  [`docs/roles-and-permissions.md`](roles-and-permissions.md)); roles are
  editable per clinic and stored in the database.
- The `SYSTEM_ADMINISTRATOR` role holds `*`; everything else is least-privilege.

## Double-witness identity verification

Identity-sensitive laboratory events (egg retrieval, insemination,
fertilization check, embryo transfer/freeze/thaw, sperm freeze/thaw, sample
allocation, cryo release, cryo disposal) require verification by a second,
**different** registered user before they can complete.

`packages/domain/src/witness.ts` enforces:

- both a primary and a witness user must be present (`WITNESS_REQUIRED`),
- the witness must be a different user (`WITNESS_SAME_USER`),
- the verification must be `VERIFIED` (`WITNESS_NOT_VERIFIED`).

## Data protection

- **Field-level encryption** for PII columns (names, identifiers, contact data)
  using an authenticated cipher; the key is per-install
  (`FICMS_FIELD_ENC_KEY`, auto-generated in standalone mode).
- **No hard deletes** of signed clinical records: corrections append and the
  audit log records who did what, when.
- Medical decisions require authorized clinical approval; the system makes no
  autonomous diagnoses or treatment decisions.

## Audit & integrity

- An audit-log repository records create/update/sign/verify/approve events.
- SQLite databases are integrity-checked (`PRAGMA integrity_check`) before
  restores and by the worker's maintenance job.
- Foreign-key enforcement is asserted after every persistence snapshot.

## Secure auto-update

- Enabled **only** in packaged builds with an explicitly configured update feed
  (`FICMS_UPDATE_URL` or `userData/update-config.json`).
- Updates are **checked but never auto-downloaded or auto-installed**; the user
  must consent to download and then to "restart & install".
- The backend is stopped before install; clinic data lives outside the app
  bundle and is never touched by an update.
- `electron-updater` verifies signatures when a code-signing certificate is
  present. Production code-signing is a deployment responsibility (no
  certificates are committed to the repo).

## Operations guidance

- Do not commit real `FICMS_APP_SECRET` / `FICMS_FIELD_ENC_KEY` values; manage
  them via the deployment's secret store.
- Back up before every migration and update (see
  [`docs/backup-restore.md`](backup-restore.md)).
- Treat the update feed as supply-chain surface: host it over HTTPS and pin the
  code-signing certificate.
