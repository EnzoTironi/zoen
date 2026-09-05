import { fileURLToPath } from "node:url";

import { PgMigrator } from "@effect/sql-pg";
import { Effect, FileSystem } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { grantD01Roles } from "../../apps/server/sql/proposals/d01/grants.ts";
import type { D01DatabaseRoles } from "../../apps/server/sql/proposals/d01/grants.ts";
import { grantD01IdentityRole } from "../../apps/server/src/identity/d01/grants.ts";

/** Called only by the migration owner, never by the server's runtime pool. */
export const applyD01Migrations = Effect.fn("migrations.applyD01")(
  function* applyD01Migrations(roles: D01DatabaseRoles) {
    const fs = yield* FileSystem.FileSystem;
    const sql = yield* SqlClient.SqlClient;
    const authority = yield* fs.readFileString(
      fileURLToPath(new URL("001_d01_authority.sql", import.meta.url))
    );
    const identity = yield* fs.readFileString(
      fileURLToPath(new URL("002_d01_identity.sql", import.meta.url))
    );
    const corrections = yield* fs.readFileString(
      fileURLToPath(new URL("003_scoped_corrections.sql", import.meta.url))
    );
    const applied = yield* PgMigrator.run({
      loader: PgMigrator.fromRecord({
        "1_d01_authority": sql.unsafe(authority).pipe(Effect.asVoid),
        "2_d01_identity": sql.unsafe(identity).pipe(Effect.asVoid),
        "3_scoped_corrections": sql.unsafe(corrections).pipe(Effect.asVoid),
      }),
    });
    yield* sql.withTransaction(
      Effect.gen(function* grantApplicationRoles() {
        yield* grantD01Roles(roles);
        yield* grantD01IdentityRole(roles.identity);
      })
    );
    return applied;
  }
);
