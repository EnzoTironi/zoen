# Independent EX22 migration and grants review

Reviewed production commit `4357917000a6078a10c3619b702693c9d9ed8a04` on an isolated worktree. No production files were changed or activated.

Executed `node --env-file=.env.infra node_modules/vitest/vitest.mjs run --project integration tests/integration/d03-sharing/independent/durable-migration.review.integration.test.ts --maxWorkers=1`: **1 test passed**, 839 ms total / 397 ms test time, on 2026-09-05. The fixture creates a dedicated real PostgreSQL database and separate login roles; runtime checks use each role's actual connection, never migration impersonation. SQL history is synthetic input to the real database, not authenticated application admission or provider evidence.

The test installs migrations 001–005 using `applySharingMigrations`, seeds authority evidence/receipts/membership, identity user/session and jobs capture/outbox, and snapshots every old authority/identity/jobs table, including empty ones. Applying `applyDisclosureMigrations` reports only migration 006. All old rows, migration metadata 001–005, table ownership/ACLs, column ACLs and schema ownership/ACLs remain exactly equal.

Authority successfully inserts both subject keys, exercises the conflict-update revision branch, records a pending permit atomically, reads subjects/permits, inserts and reads a closing barrier, and finally deletes the exact permit for acknowledgment. Eight prohibited authority statements return SQLSTATE 42501: deleting subjects or barriers; changing a subject key or barrier timestamp; updating any of the four pending columns. Identity and progress each fail SELECT, INSERT and DELETE on all three new tables: 18 actual denied statements, each with SQLSTATE 42501. Failed statements leave the recorded rows intact.

Reapplying 006 reports no migration, preserves all six migration metadata rows, and preserves pending/subject/barrier data plus all old rows and ACLs. Deleting the permit leaves both subject rows and the closing barrier intact. No previous grant was lost in the compared table, column or schema ACLs.

The initial harness run failed with PostgreSQL 0A000 because its snapshot UNION sorted by a cast expression. Changing that snapshot query to order by the JSONB result column fixed the harness; no production assertion or expected result was relaxed. A subsequent lint check found unsorted object keys in the harness, corrected without behavioral changes.

Focused lint passed afterward. Repository-wide `tsc --noEmit` on this exact base failed at `apps/cli/src/worlds/transport.ts:48` because its grouped sharing payload does not satisfy the endpoint's discriminated parameter union. No diagnostic referred to the new test. The separately reviewed CLI commits split those switch branches and passed their independent build; they are not in this migration review base. This review does not claim a green whole-repository typecheck.

## Contract sampling

`docs/contracts/disclosure-durable.md` agrees with the independent stale-snapshot experiment: both subjects must be touched atomically with permit insertion; the membership mutator touches the same membership subject under its exclusive lock before checking pending rows; stale SERIALIZABLE snapshots require full transaction retry. The existing-row and absent-row 40001 observations are accurately scoped as SQL evidence.

The document also preserves the reviewed emission conditions: one trusted synchronous buffered Node writer; mark started before handoff; acknowledgment after `end(bytes)` returns; no pending cleanup on generic scope closure, connection loss, TTL or unknown emission failure; failure after HTTP submission cannot retroactively produce a 503. Logout checks all session pending rows and commits a terminal closing barrier before external provider I/O. The barrier is not represented as proof of provider invalidation.

No contradiction was found in that sample. This review does not prove the upcoming adapter/core/HTTP implementation, concurrency under those implementations, provider logout, actual socket reception or complete release acceptance. SQL permissions allow the trusted authority component to delete permits; the semantic proof of when deletion is safe remains the executor/adapter's responsibility.
