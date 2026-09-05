import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { Effect, FileSystem } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01Database } from "../../../../apps/server/test/adapters/postgres/d01/database.js";

type Database = Parameters<Parameters<typeof withD01Database>[0]>[0];

export const applyCorrectionsDelta = (database: Database) =>
  Effect.gen(function* correctionSchema() {
    const delta = yield* FileSystem.FileSystem.use((fs) =>
      fs.readFileString(
        fileURLToPath(
          new URL(
            "../../../../packages/authority/src/knowledge/corrections/schema.sql",
            import.meta.url
          )
        )
      )
    ).pipe(Effect.provide(NodeFileSystem.layer));
    yield* Effect.gen(function* migrateCorrectionDelta() {
      const sql = yield* SqlClient.SqlClient;
      yield* sql.withTransaction(sql.unsafe(delta));
    }).pipe(Effect.provide(database.migration));
  });
export const withCorrectionsDatabase = <A, E, R>(
  run: (database: Database) => Effect.Effect<A, E, R>
) =>
  withD01Database((database) =>
    applyCorrectionsDelta(database).pipe(Effect.andThen(run(database)))
  );
