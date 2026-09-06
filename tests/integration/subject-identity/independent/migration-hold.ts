import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect, FileSystem } from "effect";
import { SqlClient } from "effect/unstable/sql";

/**
 * Opens a real migration transaction, applies 007 SQL, signals readiness, then
 * sleeps until the parent SIGKILLs. Intentionally never commits.
 */
const program = Effect.gen(function* holdMigration() {
  const migrationUrl = yield* Config.redacted("ZOEN_REVIEW_MIGRATION_URL");
  const identitySqlPath = yield* Config.string("ZOEN_REVIEW_MIGRATION_SQL");
  const readyPath = yield* Config.string("ZOEN_REVIEW_READY_FILE");
  return yield* Effect.gen(function* withSql() {
    const sql = yield* SqlClient.SqlClient;
    const fs = yield* FileSystem.FileSystem;
    const identitySql = yield* fs.readFileString(identitySqlPath);
    return yield* sql.withTransaction(
      Effect.gen(function* applyAndHold() {
        yield* sql.unsafe(identitySql);
        yield* fs.writeFileString(readyPath, "ready\n", { mode: 0o600 });
        yield* Effect.sleep("60 seconds");
        return yield* Effect.die("hold process was expected to be SIGKILL'd");
      })
    );
  }).pipe(
    Effect.provide(
      PgClient.layer({
        maxConnections: 1,
        url: migrationUrl,
      })
    )
  );
}).pipe(Effect.provide(NodeServices.layer));

NodeRuntime.runMain(program, { disableErrorReporting: true });
