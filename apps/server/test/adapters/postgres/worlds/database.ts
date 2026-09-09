import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect, FileSystem, Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { grantDisclosureRole } from "../../../../sql/proposals/disclosure/grants.ts";
import { grantContentBarrierAdmit } from "../../../../sql/proposals/erasure/grants.ts";
import { grantWorldsRoles } from "../../../../sql/proposals/worlds/grants.ts";
import { makeWorldsPostgresLayer } from "../../../../src/adapters/postgres/worlds/postgres.ts";

const profile = (url: Redacted.Redacted, name: string) => ({
  applicationName: `zoen-ex06-${name}`,
  maxConnections: 4,
  url,
});

type DatabaseRole = "authority" | "identity" | "migration" | "progress";

export interface WorldsTestDatabase {
  readonly authority: ReturnType<typeof makeWorldsPostgresLayer>;
  readonly identity: ReturnType<typeof makeWorldsPostgresLayer>;
  readonly progress: ReturnType<typeof makeWorldsPostgresLayer>;
  readonly migration: ReturnType<typeof PgClient.layer>;
  readonly names: Readonly<Record<DatabaseRole, string>>;
  readonly urls: Readonly<Record<DatabaseRole, Redacted.Redacted>>;
}

/** Real dedicated PostgreSQL database. Only this invocation's resources are removed. */
export const withWorldsDatabase = <A, E, R, E2 = never, R2 = never>(
  run: (database: WorldsTestDatabase) => Effect.Effect<A, E, R>,
  misconfiguration?: "public-create" | "replication",
  install?: (database: WorldsTestDatabase) => Effect.Effect<unknown, E2, R2>
) =>
  Effect.gen(function* configureDatabase() {
    const adminUrl = yield* Config.redacted("ZOEN_TEST_DATABASE_URL");
    const suffix = randomBytes(12).toString("hex");
    const databaseName = `ex06_${suffix}`;
    const names = {
      authority: `ex06_authority_${suffix}`,
      identity: `ex06_identity_${suffix}`,
      migration: `ex06_migration_${suffix}`,
      progress: `ex06_progress_${suffix}`,
    };
    const passwords = {
      authority: randomBytes(32).toString("hex"),
      identity: randomBytes(32).toString("hex"),
      migration: randomBytes(32).toString("hex"),
      progress: randomBytes(32).toString("hex"),
    };
    const roleUrl = (role: keyof typeof names) => {
      const url = new URL(Redacted.value(adminUrl));
      url.pathname = `/${databaseName}`;
      url.username = names[role];
      url.password = passwords[role];
      return Redacted.make(url.href);
    };
    const migration = PgClient.layer(
      profile(roleUrl("migration"), "migration")
    );
    const database: WorldsTestDatabase = {
      authority: makeWorldsPostgresLayer(
        profile(roleUrl("authority"), "authority")
      ),
      identity: makeWorldsPostgresLayer(
        profile(roleUrl("identity"), "identity")
      ),
      migration,
      names,
      progress: makeWorldsPostgresLayer(
        profile(roleUrl("progress"), "progress")
      ),
      urls: {
        authority: roleUrl("authority"),
        identity: roleUrl("identity"),
        migration: roleUrl("migration"),
        progress: roleUrl("progress"),
      },
    };
    return yield* Effect.scoped(
      Effect.gen(function* ownDatabase() {
        const admin = yield* SqlClient.SqlClient;
        for (const role of [
          "migration",
          "authority",
          "identity",
          "progress",
        ] as const) {
          yield* Effect.acquireRelease(
            // Both interpolations are generated above from fixed ASCII prefixes/hex.
            // Utility PASSWORD cannot be a PostgreSQL bound parameter.
            admin
              .unsafe(
                `CREATE ROLE "${names[role]}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS ${role === "authority" && misconfiguration === "replication" ? "REPLICATION" : "NOREPLICATION"} PASSWORD '${passwords[role]}'`
              )
              .pipe(
                Effect.mapError(
                  () => new Error("Dedicated test role creation failed")
                ),
                Effect.orDie
              ),
            () => admin`DROP ROLE ${admin(names[role])}`.pipe(Effect.orDie)
          );
        }
        yield* Effect.acquireRelease(
          admin`CREATE DATABASE ${admin(databaseName)} OWNER ${admin(names.migration)}`,
          () =>
            admin`DROP DATABASE ${admin(databaseName)} WITH (FORCE)`.pipe(
              Effect.orDie
            )
        );
        const installCandidate = Effect.gen(function* migrate() {
          const schema = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../sql/proposals/worlds/schema.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          const corrections = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../../../ops/migrations/003_scoped_corrections.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          const sql = yield* SqlClient.SqlClient;
          const format = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../../../ops/migrations/004_evidence_document_format.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          yield* sql.withTransaction(sql.unsafe(schema));
          yield* sql.withTransaction(sql.unsafe(corrections));
          yield* sql.withTransaction(sql.unsafe(format));
          const disclosure = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../../../ops/migrations/006_durable_disclosure.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          yield* sql.withTransaction(sql.unsafe(disclosure));
          const disclosureRecovery = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../../../ops/migrations/012_orphaned_disclosure_recovery.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          yield* sql.withTransaction(sql.unsafe(disclosureRecovery));
          const worldClosing = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../../../ops/migrations/014_world_closing_barrier.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          yield* sql.withTransaction(sql.unsafe(worldClosing));
          // ZA-10: object-write settlement ledger for capture admission (fail-closed).
          const objectWrite = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../../../ops/migrations/015_object_write_settlement.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          yield* sql.withTransaction(sql.unsafe(objectWrite));
          // ZA-11: observeWorld consults erasure_attempt even on retained capture paths.
          const attemptRegister = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../../../ops/migrations/009_erasure_attempt_register.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          yield* sql.withTransaction(sql.unsafe(attemptRegister));
          const controllerHead = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../../../ops/migrations/017_erasure_controller_head.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          yield* sql.withTransaction(sql.unsafe(controllerHead));
          // ZA-09 capture admission: retained DBs need progress DDL + admit grants (F02).
          const worldErasureProgress = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../../../ops/migrations/010_world_erasure_closing.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          yield* sql.withTransaction(sql.unsafe(worldErasureProgress));
          const identityBasis = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../../../ops/migrations/007_subject_identity_domain.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          yield* sql.withTransaction(sql.unsafe(identityBasis));
          const identityEvents = yield* FileSystem.FileSystem.use((fs) =>
            fs.readFileString(
              fileURLToPath(
                new URL(
                  "../../../../../../ops/migrations/008_subject_identity_events.sql",
                  import.meta.url
                )
              )
            )
          ).pipe(Effect.provide(NodeFileSystem.layer));
          yield* sql.withTransaction(sql.unsafe(identityEvents));
          yield* grantWorldsRoles(names);
          yield* grantDisclosureRole(names.authority);
          yield* grantContentBarrierAdmit(names.authority);
          // Attempt register schema may be absent on this lightweight path; grant only
          // the object-write ledger used by every capture admission (ZA-10).
          yield* sql.unsafe(
            `GRANT SELECT, INSERT, UPDATE ON jobs.object_write_attempts TO "${names.authority.replaceAll('"', "")}"`
          );
          if (misconfiguration === "public-create") {
            yield* sql`GRANT CREATE ON SCHEMA public TO ${sql(names.authority)}`;
          }
        }).pipe(Effect.provide(migration));
        yield* install === undefined ? installCandidate : install(database);
        return yield* run(database);
      })
    ).pipe(Effect.provide(PgClient.layer(profile(adminUrl, "test-admin"))));
  });
