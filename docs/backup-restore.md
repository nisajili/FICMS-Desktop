# Backup & restore

Medical data must never be lost or silently overwritten. FICMS provides both a
CLI and an API for backups, and a restore path that validates and snapshots
before touching the live database.

## Backup

### CLI

```bash
# SQLite (default): atomic snapshot of the live database
corepack pnpm --filter @ficms/api backup [dest.db]

# or via the root script
corepack pnpm backup
```

- The SQLite engine exports a consistent in-memory snapshot and writes it with
  `write-to-temp + rename`, so a backup is never a torn write.
- PostgreSQL backups are the DBA's responsibility (`pg_dump`); the CLI writes a
  guidance marker instead.

### API

- `POST /api/v1/backup` (requires `backup:create`) triggers a backup.
- `GET /api/v1/backup/integrity` runs `PRAGMA integrity_check` and reports the
  result.

### Worker

The background worker's `backup.run` job invokes `Database.backupTo()`; schedule
it (e.g. daily) when Redis/BullMQ is enabled.

## Restore (SQLite)

```bash
corepack pnpm --filter @ficms/api restore <backup.db>
```

The restore CLI (`apps/api/src/cli/restore.ts`) is deliberately conservative:

1. **Validate** — opens the backup and runs `PRAGMA integrity_check`; refuses to
   restore if the result is not `ok`.
2. **Snapshot** — if a live database exists, it is copied to
   `<live>.pre-restore-<timestamp>` before anything is overwritten.
3. **Atomic copy** — the validated backup is written to a temp file and renamed
   into place.

PostgreSQL restores are refused by the CLI and must use `pg_restore` with a
point-in-time recovery plan.

## Operating rules

- **Back up before every migration or update.** The migration runner should be
  preceded by a backup + integrity verify where possible.
- Run the restore with the API **stopped** to avoid two writers.
- Keep the `.pre-restore-*` snapshot until the restore is confirmed good.
- Automate a daily backup and periodically **test the restore** — an untested
  backup is not a backup.

## Standalone desktop

In standalone mode the desktop app stores data under `userData/data/` and keeps
a local backups directory under `userData/backups/`. Back up the whole
`userData` directory (database + `storage/` + secrets) for a complete,
restorable copy of a single machine's clinic data.
