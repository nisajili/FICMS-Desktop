# Offline synchronization

FICMS supports offline-first operation for deployments where connectivity to
the server can be intermittent. The design guarantees that a client going
offline can never bypass clinical, financial, or identity-safety rules.

## Model

- Clients **queue operations** locally with an **idempotency key** per operation.
- On reconnect, clients `POST /api/v1/sync/push` with the pending operations.
- The server **replays** operations through the same transactional repositories
  the live API uses — so payment idempotency, stock guards, double-witness
  checks, and permission validation are enforced server-side, never bypassed.
- Version conflicts are recorded and surfaced for **authorized resolution**
  rather than silently overwritten.

## API surface

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/sync/push` | submit queued operations |
| `GET /api/v1/sync/conflicts` | list unresolved conflicts |
| `POST /api/v1/sync/conflicts/:id/resolve` | resolve a conflict (authorized) |
| `GET /api/v1/sync/status` | synchronization status |

## Operation lifecycle

1. `sync.enqueue(...)` records the operation with its idempotency key.
2. `sync.markSyncing(id)` marks it in-flight.
3. The operation is applied through the domain repository.
4. On success `sync.markApplied(id)`; the response reports `APPLIED`.
5. On failure the operation is reported `CONFLICT` and a conflict row is
   recorded with the reason.

Because the idempotency key is part of the underlying repository (for example
payments are deduplicated by key), replaying the same push is safe.

## What can be replayed

The sync service deliberately supports a conservative set of operations
(`apps/api/src/modules/sync/sync.service.ts`) — starting with idempotent-by-key
financially/clinical-safe mutations such as payments. Expanding the set is a
deliberate, reviewed change, not an automatic one.

## Client guidance

- Use a monotonic local queue with retry and backoff.
- Never delete a queued operation until the server acknowledges `APPLIED`.
- Resolve conflicts through an authorized user; do not auto-resolve.
