import { fileURLToPath } from "node:url";

import { PgMigrator } from "@effect/sql-pg";
import { Effect, FileSystem } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { grantDisclosureRole } from "../../apps/server/sql/proposals/disclosure/grants.ts";
import {
  grantContentBarrierAdmit,
  grantErasureRole,
} from "../../apps/server/sql/proposals/erasure/grants.ts";
import { grantSubjectIdentityRole } from "../../apps/server/sql/proposals/subject-identity/grants.ts";
import { grantWorldsRoles } from "../../apps/server/sql/proposals/worlds/grants.ts";
import type { WorldsDatabaseRoles } from "../../apps/server/sql/proposals/worlds/grants.ts";
import { grantIdentityRole } from "../../apps/server/src/identity/worlds/grants.ts";

/** Called only by the migration owner, never by the server's runtime pool. */
export const applyWorldsBaselineMigrations = Effect.fn(
  "migrations.applyWorldsBaseline"
)(function* applyWorldsBaselineMigrations(roles: WorldsDatabaseRoles) {
  const fs = yield* FileSystem.FileSystem;
  const sql = yield* SqlClient.SqlClient;
  const authority = yield* fs.readFileString(
    fileURLToPath(new URL("001_authority.sql", import.meta.url))
  );
  const identity = yield* fs.readFileString(
    fileURLToPath(new URL("002_identity.sql", import.meta.url))
  );
  const corrections = yield* fs.readFileString(
    fileURLToPath(new URL("003_scoped_corrections.sql", import.meta.url))
  );
  const applied = yield* PgMigrator.run({
    loader: PgMigrator.fromRecord({
      "1_authority": sql.unsafe(authority).pipe(Effect.asVoid),
      "2_identity": sql.unsafe(identity).pipe(Effect.asVoid),
      "3_scoped_corrections": sql.unsafe(corrections).pipe(Effect.asVoid),
    }),
  });
  yield* sql.withTransaction(
    Effect.gen(function* grantApplicationRoles() {
      yield* grantWorldsRoles(roles);
      yield* grantIdentityRole(roles.identity);
    })
  );
  return applied;
});

/** The published Worlds baseline stays reproducible; the current application extends it explicitly. */
export const applyApplicationMigrations = Effect.fn(
  "migrations.applyApplication"
)(function* applyApplicationMigrations(roles: WorldsDatabaseRoles) {
  const base = yield* applyWorldsBaselineMigrations(roles);
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
  function* applySharingMigrations(roles: WorldsDatabaseRoles) {
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
)(function* applyDisclosureMigrations(roles: WorldsDatabaseRoles) {
  const base = yield* applySharingMigrations(roles);
  const fs = yield* FileSystem.FileSystem;
  const sql = yield* SqlClient.SqlClient;
  const disclosure = yield* fs.readFileString(
    fileURLToPath(new URL("006_durable_disclosure.sql", import.meta.url))
  );
  const durable = yield* PgMigrator.run({
    loader: PgMigrator.fromRecord({
      "6_durable_disclosure": sql.unsafe(disclosure).pipe(Effect.asVoid),
    }),
  });
  // Apply progress / orphaned-recovery / world-closing / object-write DDL without
  // migrator ids 10/12/14/15 here: Effect migrator skips any id <= latest, so
  // recording them before 7/8 would skip identity events. Erasure migrator
  // records 10/12/14/15 after 7–11. Capture admission (ZA-09/ZA-10) needs
  // progress + object_write_attempts DDL+grants on retained installs too
  // (F02: schema without enabling erasure).
  const progress = yield* fs.readFileString(
    fileURLToPath(new URL("010_world_erasure_closing.sql", import.meta.url))
  );
  yield* sql.withTransaction(sql.unsafe(progress));
  const recovery = yield* fs.readFileString(
    fileURLToPath(
      new URL("012_orphaned_disclosure_recovery.sql", import.meta.url)
    )
  );
  yield* sql.withTransaction(sql.unsafe(recovery));
  const worldClosing = yield* fs.readFileString(
    fileURLToPath(new URL("014_world_closing_barrier.sql", import.meta.url))
  );
  yield* sql.withTransaction(sql.unsafe(worldClosing));
  const objectWrite = yield* fs.readFileString(
    fileURLToPath(new URL("015_object_write_settlement.sql", import.meta.url))
  );
  yield* sql.withTransaction(sql.unsafe(objectWrite));
  yield* sql.withTransaction(grantDisclosureRole(roles.authority));
  // Progress + object-write admit grants for capture on retained paths (F02).
  yield* sql.withTransaction(grantContentBarrierAdmit(roles.authority));
  return [...base, ...durable];
});

/** Basis v2 is an explicit transition; the five-domain executables retain migrations 001–006. */
export const applyIdentityBasisMigrations = Effect.fn(
  "migrations.applyIdentityBasis"
)(function* applyIdentityBasisMigrations(roles: WorldsDatabaseRoles) {
  const base = yield* applyDisclosureMigrations(roles);
  const fs = yield* FileSystem.FileSystem;
  const sql = yield* SqlClient.SqlClient;
  const identity = yield* fs.readFileString(
    fileURLToPath(new URL("007_subject_identity_domain.sql", import.meta.url))
  );
  const events = yield* fs.readFileString(
    fileURLToPath(new URL("008_subject_identity_events.sql", import.meta.url))
  );
  const extension = yield* PgMigrator.run({
    loader: PgMigrator.fromRecord({
      "7_subject_identity_domain": sql.unsafe(identity).pipe(Effect.asVoid),
      "8_subject_identity_events": sql.unsafe(events).pipe(Effect.asVoid),
    }),
  });
  yield* sql.withTransaction(grantSubjectIdentityRole(roles.authority));
  return [...base, ...extension];
});

/** Closing register + progress DDL; retained installs get schema without enabling erasure (F02). */
export const applyErasureMigrations = Effect.fn("migrations.applyErasure")(
  function* applyErasureMigrations(roles: WorldsDatabaseRoles) {
    const base = yield* applyIdentityBasisMigrations(roles);
    const fs = yield* FileSystem.FileSystem;
    const sql = yield* SqlClient.SqlClient;
    const attempt = yield* fs.readFileString(
      fileURLToPath(
        new URL("009_erasure_attempt_register.sql", import.meta.url)
      )
    );
    const closing = yield* fs.readFileString(
      fileURLToPath(new URL("010_world_erasure_closing.sql", import.meta.url))
    );
    const rename = yield* fs.readFileString(
      fileURLToPath(new URL("011_worlds_rename_alignment.sql", import.meta.url))
    );
    const recovery = yield* fs.readFileString(
      fileURLToPath(
        new URL("012_orphaned_disclosure_recovery.sql", import.meta.url)
      )
    );
    const policyIds = yield* fs.readFileString(
      fileURLToPath(new URL("013_za03_policy_profile_ids.sql", import.meta.url))
    );
    const worldClosing = yield* fs.readFileString(
      fileURLToPath(new URL("014_world_closing_barrier.sql", import.meta.url))
    );
    const objectWrite = yield* fs.readFileString(
      fileURLToPath(new URL("015_object_write_settlement.sql", import.meta.url))
    );
    const copyCatalog = yield* fs.readFileString(
      fileURLToPath(new URL("016_controlled_copy_catalog.sql", import.meta.url))
    );
    const controllerHead = yield* fs.readFileString(
      fileURLToPath(new URL("017_erasure_controller_head.sql", import.meta.url))
    );
    const extension = yield* PgMigrator.run({
      loader: PgMigrator.fromRecord({
        "10_world_erasure_closing": sql.unsafe(closing).pipe(Effect.asVoid),
        "11_worlds_rename_alignment": sql.unsafe(rename).pipe(Effect.asVoid),
        "12_orphaned_disclosure_recovery": sql
          .unsafe(recovery)
          .pipe(Effect.asVoid),
        "13_za03_policy_profile_ids": sql.unsafe(policyIds).pipe(Effect.asVoid),
        "14_world_closing_barrier": sql
          .unsafe(worldClosing)
          .pipe(Effect.asVoid),
        "15_object_write_settlement": sql
          .unsafe(objectWrite)
          .pipe(Effect.asVoid),
        "16_controlled_copy_catalog": sql
          .unsafe(copyCatalog)
          .pipe(Effect.asVoid),
        "17_erasure_controller_head": sql
          .unsafe(controllerHead)
          .pipe(Effect.asVoid),
        "9_erasure_attempt_register": sql.unsafe(attempt).pipe(Effect.asVoid),
      }),
    });
    yield* sql.withTransaction(
      Effect.gen(function* grantErasureAndWorldBarrier() {
        yield* grantErasureRole(roles.authority);
        yield* grantDisclosureRole(roles.authority);
      })
    );
    return [...base, ...extension];
  }
);
