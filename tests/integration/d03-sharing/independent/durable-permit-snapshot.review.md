# Independent durable-permit protocol review

## Executed evidence

The original experiment was run with `node --env-file=.env.infra tests/integration/d03-sharing/independent/durable-permit-snapshot.review.mjs` against the configured real PostgreSQL database. The script owns a randomly named schema and drops only that schema. No service/provider response is mocked. This is a SQL concurrency experiment, not product, HTTP, Better Auth, or full disclosure acceptance.

Observed on 2026-09-05:

```json
{"mode":"unsafe","stalePending":0,"actualPending":1,"state":"revoked","unsafeCommitReproduced":true}
{"mode":"existing-subject","staleSnapshotSqlstate":"40001","freshPending":1,"state":"active"}
{"mode":"absent-subject","staleSnapshotSqlstate":"40001","freshPending":1,"state":"active"}
```

The unsafe case establishes a SERIALIZABLE revoker snapshot before the reader commits a permit. The reader holds the shared advisory lock during permit insertion and physically closes its PostgreSQL connection afterward. The revoker acquires the exclusive advisory lock, sees zero permits in its old snapshot, changes membership, and commits successfully. An independent connection sees both the pending permit and revoked membership. PostgreSQL SSI does not reject this history by itself.

The two treatment cases atomically write a subject revision and insert the permit in the reader transaction. The revoker performs the same subject upsert after obtaining the exclusive lock and before inspecting permits. Its stale transaction fails with SQLSTATE 40001 both when the subject existed before its snapshot and when the subject was absent. A new transaction acquires the exclusive lock, writes the revision, sees the pending permit, and rolls back; membership stays active and the pending permit survives.

## Conditions for the proposed production protocol

- Every permit insertion must atomically update the relevant session and membership subject rows. All disclosure paths must use the same authority PostgreSQL database and subject-key derivation. A session subject write alone does not protect a membership revoker that writes another row.
- Every membership revocation must write its subject after obtaining the exclusive lock and before checking pending permits, including retries of an already-started SERIALIZABLE semantic transaction. A 40001 must restart the entire semantic transaction, not just the query/savepoint. Exhausted retries fail closed.
- A pending permit prevents successful revocation. The subject revision is a concurrency fence, not a replacement for that check. Pending permits and unknown emission outcomes must not expire by time or coordinator connection loss.
- Logout must acquire the session exclusive lock, check all pending session permits, and commit a durable session-closing barrier before external identity-provider I/O. The committed barrier must prevent new permits even if the coordinator connection subsequently disappears. This review did not execute that cross-database/provider flow.
- Permit deletion requires either positive acknowledgment that the owned private writer's `end(bytes)` returned or proof that this attempt can never emit. Generic scope closure, cancellation, an HTTP failure response, or an expired lease does not supply that proof.

## Native HTTP writer review

The installed Effect Node HTTP implementation exposes `NodeHttpServerRequest.toServerResponse(request)`. Its normal writer returns immediately when `writableEnded` is already true. A narrowly owned native helper can therefore apply headers, synchronously call `writeHead` and `end(privateBytes)`, and then return an empty framework response. The coordinator may acknowledge only successful completion of this specific helper. This conclusion is code inspection, not an executed HTTP acceptance result.

Guards and required response headers must run before invoking that helper: framework pre-response processing after it cannot change bytes already handed off. Mark emission as started before the first private-byte handoff; permit cleanup after a throw, interruption, or coordinator loss during/after invocation is unsafe without positive acknowledgment. No detached continuation or second emitter may retain these bytes. A callback that merely succeeds without invoking the trusted writer is not an acknowledgment; an opaque result from the owned writer makes that distinction explicit.

If acknowledgment persistence fails after `end(bytes)` returns, the client may already receive HTTP 200. The implementation cannot retroactively guarantee a 503. Preserve the permit; an acknowledgment retry must refer to the same completed emission attempt and must never retransmit private bytes to obtain proof. A crash before acknowledgment commit likewise leaves the durable permit pending. A never-started callback can release its permit only if the implementation also proves no future callback invocation is possible.

The SQL treatment closes the demonstrated stale-snapshot hole under the stated write discipline. It does not establish complete production integration, real socket delivery, browser behavior, logout semantics, or independent product acceptance.

## Preserved original experiment

The exact original UTF-8 source below has SHA-256 `da01ee9d1c363bbe6b5d0176cfe69a85a437e008df412e991289b25882049e7e`. It is retained as historical evidence after conversion to the integration suite.

```javascript
// Independent PostgreSQL protocol experiment; not an HTTP/provider acceptance test.
// Run: node --env-file=.env.infra tests/integration/d03-sharing/independent/durable-permit-snapshot.review.mjs
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(new URL("../../../../apps/server/package.json", import.meta.url));
const { Client } = require("pg");
const connectionString = process.env.ZOEN_TEST_DATABASE_URL;
assert.ok(connectionString, "ZOEN_TEST_DATABASE_URL is required");

for (const mode of ["unsafe", "existing-subject", "absent-subject"]) {
  const schema = `review_${randomUUID().replaceAll("-", "")}`;
  const observer = new Client({ connectionString });
  const reader = new Client({ connectionString });
  const revoker = new Client({ connectionString });
  const clients = [observer, reader, revoker];
  try {
    await Promise.all(clients.map((client) => client.connect()));
    await observer.query(`CREATE SCHEMA ${schema}`);
    for (const client of clients) {
      await client.query(`SET search_path TO ${schema}`);
      await client.query("SET statement_timeout TO '5s'");
    }
    await observer.query("CREATE TABLE membership (state text NOT NULL); INSERT INTO membership VALUES ('active')");
    await observer.query("CREATE TABLE permits (id text PRIMARY KEY)");
    await observer.query("CREATE TABLE subjects (key text PRIMARY KEY, revision bigint NOT NULL)");
    if (mode === "existing-subject") {
      await observer.query("INSERT INTO subjects VALUES ('membership', 0)");
    }
    const bump = "INSERT INTO subjects VALUES ('membership', 1) ON CONFLICT (key) DO UPDATE SET revision = subjects.revision + 1";
    const lock = schema; // Unique advisory key for this run, shared by these two connections.
    await revoker.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
    assert.equal((await revoker.query("SELECT state FROM membership")).rows[0].state, "active");
    await reader.query("SELECT pg_advisory_lock_shared(hashtextextended($1, 0))", [lock]);
    await reader.query("BEGIN");
    if (mode !== "unsafe") await reader.query(bump);
    await reader.query("INSERT INTO permits VALUES ('pending-emission')");
    await reader.query("COMMIT");
    // Actual connection loss releases the coordinator lock while the durable permit remains.
    await reader.end();
    await revoker.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock]);
    if (mode === "unsafe") {
      const stalePending = Number((await revoker.query("SELECT count(*) AS n FROM permits")).rows[0].n);
      assert.equal(stalePending, 0);
      await revoker.query("UPDATE membership SET state = 'revoked'");
      await revoker.query("COMMIT");
      const actualPending = Number((await observer.query("SELECT count(*) AS n FROM permits")).rows[0].n);
      assert.equal(actualPending, 1);
      assert.equal((await observer.query("SELECT state FROM membership")).rows[0].state, "revoked");
      console.log(JSON.stringify({ mode, stalePending, actualPending, state: "revoked", unsafeCommitReproduced: true }));
    } else {
      await assert.rejects(revoker.query(bump), (error) => error.code === "40001");
      await revoker.query("ROLLBACK");
      await revoker.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
      await revoker.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [lock]);
      await revoker.query(bump);
      const freshPending = Number((await revoker.query("SELECT count(*) AS n FROM permits")).rows[0].n);
      assert.equal(freshPending, 1);
      // The semantic executor must refuse revocation and roll back at this point.
      await revoker.query("ROLLBACK");
      assert.equal((await observer.query("SELECT state FROM membership")).rows[0].state, "active");
      assert.equal(Number((await observer.query("SELECT count(*) AS n FROM permits")).rows[0].n), 1);
      console.log(JSON.stringify({ mode, staleSnapshotSqlstate: "40001", freshPending, state: "active" }));
    }
  } finally {
    await revoker.query("ROLLBACK").catch(() => {});
    await observer.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {});
    await Promise.all(clients.map((client) => client.end().catch(() => {})));
  }
}
```

## Typed integration-suite conversion

Run `pnpm test:integration tests/integration/d03-sharing/independent/durable-permit-snapshot.review.integration.test.ts` with the existing `.env.infra` PostgreSQL configuration. On 2026-09-05 at 17:25:21 local time, Vitest executed all three scenarios: **3 passed**, one file, 236 ms total (90 ms tests). Whole-worktree TypeScript checking and linting of the new test also passed.

The conversion preserves the three original oracles, including the unsafe successful commit, physical reader connection closure, actual SQLSTATE 40001 for both subject-row histories, fresh-snapshot pending-permit detection, and rollback leaving membership active. It uses Effect-scoped native PostgreSQL connections because this experiment must physically close the reader, not release a pooled reservation. The server workspace owns the `pg` dependency; the sole narrow lint suppression annotates Node's untyped `require` import boundary. All SQL results inspected by the assertions are schema decoded.

The original runnable `.mjs` duplicate was removed only after its exact bytes and SHA-256 were preserved above. This conversion adds regression execution to the SQL review; it supplies no additional HTTP, provider, or product-acceptance claim.
