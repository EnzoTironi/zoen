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
