import { fileURLToPath } from "node:url";

import { PgMigrator } from "@effect/sql-pg";
import { Effect, FileSystem } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { grantD01Roles } from "../../apps/server/sql/proposals/d01/grants.ts";
import type { D01DatabaseRoles } from "../../apps/server/sql/proposals/d01/grants.ts";
import { grantDisclosureRole } from "../../apps/server/sql/proposals/disclosure/grants.ts";
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

/** The published D01 baseline stays reproducible; the current application extends it explicitly. */
export const applyApplicationMigrations = Effect.fn(
  "migrations.applyApplication"
)(function* applyApplicationMigrations(roles: D01DatabaseRoles) {
  const base = yield* applyD01Migrations(roles);
  const fs = yield* FileSystem.FileSystem;
  const sql = yield* SqlClient.SqlClient;
  const format = yield* fs.readFileString(
    fileURLToPath(new URL("004_evidence_document_format.sql", import.meta.url))
  );
  const extension = yield* PgMigrator.run({
    loader: PgMigrator.fromRecord({
      "4_evidence_document_format": sql.unsafe(format).pipe(Effect.asVoid),
    }),
  });
  return [...base, ...extension];
});

/** Sharing is an explicit extension; retained JSON/CSV migration baselines remain reproducible. */
export const applySharingMigrations = Effect.fn("migrations.applySharing")(
  function* applySharingMigrations(roles: D01DatabaseRoles) {
    const base = yield* applyApplicationMigrations(roles);
    const fs = yield* FileSystem.FileSystem;
    const sql = yield* SqlClient.SqlClient;
    const sharing = yield* fs.readFileString(
      fileURLToPath(new URL("005_world_read_membership.sql", import.meta.url))
    );
    const extension = yield* PgMigrator.run({
      loader: PgMigrator.fromRecord({
        "5_world_read_membership": sql.unsafe(sharing).pipe(Effect.asVoid),
      }),
    });
    return [...base, ...extension];
  }
);

/** Durable coordination extends the separately reproducible membership migration. */
export const applyDisclosureMigrations = Effect.fn(
  "migrations.applyDisclosure"
)(function* applyDisclosureMigrations(roles: D01DatabaseRoles) {
  const base = yield* applySharingMigrations(roles);
  const fs = yield* FileSystem.FileSystem;
  const sql = yield* SqlClient.SqlClient;
  const disclosure = yield* fs.readFileString(
    fileURLToPath(new URL("006_durable_disclosure.sql", import.meta.url))
  );
  const extension = yield* PgMigrator.run({
    loader: PgMigrator.fromRecord({
      "6_durable_disclosure": sql.unsafe(disclosure).pipe(Effect.asVoid),
    }),
  });
  yield* sql.withTransaction(grantDisclosureRole(roles.authority));
  return [...base, ...extension];
});

/** Basis v2 is an explicit transition; the five-domain executables retain migrations 001–006. */
export const applyIdentityBasisMigrations = Effect.fn(
  "migrations.applyIdentityBasis"
)(function* applyIdentityBasisMigrations(roles: D01DatabaseRoles) {
  const base = yield* applyDisclosureMigrations(roles);
  const fs = yield* FileSystem.FileSystem;
  const sql = yield* SqlClient.SqlClient;
  const identity = yield* fs.readFileString(
    fileURLToPath(new URL("007_subject_identity_domain.sql", import.meta.url))
  );
  const extension = yield* PgMigrator.run({
    loader: PgMigrator.fromRecord({
      "7_subject_identity_domain": sql.unsafe(identity).pipe(Effect.asVoid),
    }),
  });
  return [...base, ...extension];
});
