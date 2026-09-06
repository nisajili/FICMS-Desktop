# FICMS — Fertility & IVF Clinic Management System

FICMS is a vendor-neutral, white-label clinical management system for fertility
and IVF clinics, delivered as native desktop software for **Windows 10/11**,
**macOS (Intel + Apple Silicon)**, and **major Linux distributions**.

It is a complete, integrated system — not a prototype or a website wrapper —
covering reception, EMR, fertility consultations, ART/IVF/ICSI/IUI cycle
management, andrology & embryology laboratories, ultrasound, nursing, general
laboratory, pharmacy & inventory, finance & billing, counseling, donor
management, human resources, and reporting.

> **White-label by design.** No clinic name, logo, contact details, country, or
> currency is hard-coded. Every piece of clinic configuration is stored in the
> database and editable by an administrator.

---

## Operating modes

| Mode | Backend | Network | Typical use |
|------|---------|---------|-------------|
| **Standalone Desktop** | Embedded, bound to `127.0.0.1` on an ephemeral port | Local only | Single-machine clinics; data never leaves the device |
| **On-Premise LAN** | Self-hosted FICMS API on the clinic network | Private LAN | Multi-workstation clinics behind their own firewall |
| **Connected Clinic** | Hosted FICMS API over HTTPS | Internet (TLS) | Multi-branch/centralized deployments |

In standalone mode the embedded backend is bound to loopback only, uses a
per-install secret, and never exposes an unauthenticated API. See
[`docs/deployment.md`](docs/deployment.md).

---

## Repository layout

```
apps/
  api/        NestJS backend — versioned REST API under /api/v1, OpenAPI docs
  desktop/    Electron + React/Vite desktop app (main, preload, renderer)
  worker/     Background worker — maintenance jobs + BullMQ (in-process fallback)
packages/
  config/     Environment mapping + validated config schema
  types/      Shared TypeScript contracts
  domain/     Business rules: RBAC/roles, double-witness, numbering
  security/   Password hashing, TOTP, tokens, field cipher
  database/   sql.js (WASM SQLite) + pure-JS PostgreSQL engines, repositories
  eslint-config/  Shared ESLint config
  tsconfig/   Shared TypeScript configs
scripts/      Release tooling: checksums, SBOM, release-prepare
docs/         Architecture, operations, and guides (incl. OpenAPI spec)
```

Key decisions:

- **`pnpm` monorepo** with a committed lockfile and pinned production deps.
- **Database**: sql.js (WASM SQLite) for desktop/standalone with atomic
  write-to-temp+rename persistence and foreign-key enforcement; a pure-JS
  `pg` engine for PostgreSQL deployments. Repositories sit above both engines.
- **No native build steps** are required for the core (no Prisma engine or
  `node-gyp`); this keeps the runtime dependency-free inside Electron.
- **NestJS API** with decorators, zod request validation, permission guards,
  and Swagger/OpenAPI at `/docs` (UI) and `/docs-json` (spec).

---

## Quick start (development)

Prerequisites: Node.js ≥ 20.11 and `pnpm` (Corepack is recommended).

```bash
corepack enable
corepack pnpm install                # ELECTRON_SKIP_BINARY_DOWNLOAD=1 on headless CI
corepack pnpm -r build               # build packages + apps
corepack pnpm -r test                # unit + integration + API e2e
```

Run the API (seeds a fresh SQLite database with a demo admin):

```bash
FICMS_SEED=true \
FICMS_HOST=0.0.0.0 FICMS_PORT=4123 \
FICMS_APP_SECRET=dev-secret-change-me \
DATABASE_URL=file:.ficms-data/api.db \
node apps/api/dist/main.js
```

Run the desktop renderer in the browser (proxies `/api` to `127.0.0.1:4123`):

```bash
corepack pnpm --filter @ficms/desktop dev
```

Run the desktop app itself (requires the Electron binary):

```bash
corepack pnpm --filter @ficms/desktop dev:electron
```

**Seed login** (development only): username `admin`, password `ChangeMe123!`
(role `SYSTEM_ADMINISTRATOR`, must change password on first login).

---

## Security model (summary)

- **Electron hardening**: `sandbox`, `contextIsolation`, `nodeIntegration: false`,
  `webSecurity`, restricted navigation, denied permission requests, and a
  minimal context-bridge (`window.ficms`) exposing only allow-listed functions.
- **Tokens**: access tokens live in memory; an optional "remember me" stores the
  session encrypted with the OS keychain (`safeStorage`) — never `localStorage`.
- **RBAC/ABAC**: 20 shipped roles with a resource:action permission matrix,
  editable per clinic. See [`docs/roles-and-permissions.md`](docs/roles-and-permissions.md).
- **Double-witness identity verification** for identity-sensitive lab events
  (egg retrieval, insemination, embryo transfer/freeze/thaw, cryo release, …).
- **Encrypted PII** at the field level with a per-install key.
- **No hard deletes** of signed clinical records; corrections append to the
  audit log.
- **Secure auto-update**: updates are checked but never auto-installed; the
  user must explicitly consent, and a failed update never touches clinic data.
  See [`docs/security.md`](docs/security.md).

---

## Testing

```bash
corepack pnpm -r test          # all packages: config, domain, security, database, api
corepack pnpm -r typecheck
corepack pnpm -r lint
corepack pnpm --filter @ficms/api run test:e2e   # API e2e (spawns the built server)
```

---

## Packaging & release

Installers are produced on native-OS CI runners (`.github/workflows`):

- **Windows**: NSIS `.exe` (x64/arm64) + MSI `.msi`
- **macOS**: DMG `.dmg` + PKG `.pkg` (x64/arm64)
- **Linux**: AppImage, `.deb`, `.rpm`

Every release includes **SHA-256 checksums** (`SHA256SUMS`) and a
**CycloneDX SBOM**. See [`docs/release-and-rollback.md`](docs/release-and-rollback.md).

```bash
corepack pnpm --filter @ficms/desktop dist:win
corepack pnpm --filter @ficms/desktop dist:mac
corepack pnpm --filter @ficms/desktop dist:linux
node scripts/gen-checksums.mjs apps/desktop/release
node scripts/gen-sbom.mjs
```

---

## Documentation

- [Architecture](docs/architecture.md) — components, data flow, engines
- [Getting started](docs/getting-started.md) — local development
- [Deployment](docs/deployment.md) — the three operating modes
- [Security](docs/security.md) — Electron, auth, encryption, audit
- [Roles & permissions](docs/roles-and-permissions.md) — the full matrix
- [Offline sync](docs/offline-sync.md) — queueing, idempotency, conflicts
- [API](docs/api.md) — endpoints, auth, OpenAPI spec ([`docs/openapi.json`](docs/openapi.json))
- [Backup & restore](docs/backup-restore.md) — CLI + API
- [Release & rollback](docs/release-and-rollback.md) — CI, checksums, SBOM, auto-update
- [Assumptions](docs/assumptions.md) — technical decisions and limitations

---

## License

Source code is provided under a proprietary (UNLICENSED) license. This project
does not ship production credentials, signing certificates, or external service
access. Regulatory approval and production code-signing remain the
responsibility of the deploying clinic.
