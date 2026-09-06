# Release & rollback

## CI

Two workflows drive the pipeline (`.github/workflows/`):

- **`ci.yml`** — runs on every push to `main` and every PR:
  - `verify`: install (`--frozen-lockfile`), build, lint, typecheck, test
    (unit + integration + API e2e).
  - `package`: native-OS packaging matrix —
    - `ubuntu-latest` → AppImage/deb/rpm (x64)
    - `windows-latest` → NSIS `.exe` + MSI (x64)
    - `macos-13` → dmg/pkg (Intel x64)
    - `macos-14` → dmg/pkg (Apple Silicon arm64)
  - Each package job produces SHA-256 checksums and a CycloneDX SBOM and
    uploads everything as a build artifact.
- **`release.yml`** — on a `v*` tag (or manual dispatch), packages all four
  targets and publishes a GitHub Release with the installers, `SHA256SUMS`,
  and `sbom.cdx.json` attached.
- **`codeql.yml`** — static security analysis on `main` and PRs.

Code-signing certificates are **not** committed. CI produces unsigned
artifacts; a releasing clinic supplies its own certificates to sign.

## Release steps

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm -r --filter './packages/**' --filter './apps/**' build
corepack pnpm -r typecheck && corepack pnpm -r lint && corepack pnpm -r test

# package per platform (native runners)
corepack pnpm --filter @ficms/desktop dist:linux   # etc.

# checksums + SBOM
node scripts/gen-checksums.mjs apps/desktop/release
node scripts/gen-sbom.mjs --out apps/desktop/release/sbom.cdx.json

# or run the orchestrator
node scripts/release-prepare.mjs
```

`scripts/release-prepare.mjs` runs the full install/build/verify/test sequence,
then generates checksums and the SBOM.

## Verifying a release

```bash
cd apps/desktop/release
sha256sum -c SHA256SUMS        # all artifacts: OK
```

The SBOM (`sbom.cdx.json`) is a CycloneDX 1.4 document enumerating the resolved
dependency graph from `pnpm-lock.yaml`.

## Auto-update

- Packaged builds enable auto-update only when an update feed is configured:
  - `FICMS_UPDATE_URL` environment variable, or
  - `update-config.json` in the app data dir (`{ "feedUrl": "https://…" }`).
- The feed is a **generic** update server (`latest.yml` for Windows,
  `latest-mac.yml`, `latest-linux.yml` — the metadata files electron-builder
  emits alongside the installers).
- Updates are checked on demand (Settings → Software updates), downloaded only
  with explicit user consent, and installed only when the user chooses
  "Restart & install".
- The backend is stopped before install and clinic data lives outside the app
  bundle, so an update never overwrites or deletes clinic data.

## Rollback

Rolling back an application update:

1. **Uninstall/reinstall** the previous version's installer (installers are
   versioned and retained; the app data directory is not deleted on uninstall —
   `deleteAppDataOnUninstall: false`).
2. **Never** roll back a database migration by deleting data. Restore from the
   pre-update backup instead:
   ```bash
   corepack pnpm --filter @ficms/api restore <pre-update-backup.db>
   ```
3. Verify integrity and spot-check data after rollback.

Rolling back a bad migration:

1. Restore the pre-migration backup (taken in the release steps above).
2. Re-run the app at the previous version.
3. Re-apply intended changes as a new, reviewed migration — never edit an
   already-shipped migration.

## Versioning & numbering

- App version in `apps/desktop/package.json` (`0.1.0`).
- Tags follow `v<semver>`; GitHub Releases are generated from release notes.
- The API prefix is versioned independently (`/api/v1`).
