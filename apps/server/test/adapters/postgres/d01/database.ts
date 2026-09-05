import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { Config, Effect, FileSystem, Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { grantD01Roles } from "../../../../sql/proposals/d01/grants.ts";
import { makeD01PostgresLayer } from "../../../../src/adapters/postgres/d01/postgres.ts";

const profile = (url: Redacted.Redacted, name: string) => ({
  applicationName: `zoen-ex06-${name}`,
  maxConnections: 4,
  url,
});

type DatabaseRole = "authority" | "identity" | "migration" | "progress";

export interface D01TestDatabase {
  readonly authority: ReturnType<typeof makeD01PostgresLayer>;
  readonly identity: ReturnType<typeof makeD01PostgresLayer>;
  readonly progress: ReturnType<typeof makeD01PostgresLayer>;
  readonly migration: ReturnType<typeof PgClient.layer>;
  readonly names: Readonly<Record<DatabaseRole, string>>;
  readonly urls: Readonly<Record<DatabaseRole, Redacted.Redacted>>;
}

/** Real dedicated PostgreSQL database. Only this invocation's resources are removed. */
export const withD01Database = <A, E, R, E2 = never, R2 = never>(
  run: (database: D01TestDatabase) => Effect.Effect<A, E, R>,
  misconfiguration?: "public-create" | "replication",
  install?: (database: D01TestDatabase) => Effect.Effect<unknown, E2, R2>
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
    const database: D01TestDatabase = {
      authority: makeD01PostgresLayer(
        profile(roleUrl("authority"), "authority")
      ),
      identity: makeD01PostgresLayer(profile(roleUrl("identity"), "identity")),
      migration,
      names,
      progress: makeD01PostgresLayer(profile(roleUrl("progress"), "progress")),
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
                  "../../../../sql/proposals/d01/schema.sql",
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
          yield* grantD01Roles(names);
          if (misconfiguration === "public-create") {
            yield* sql`GRANT CREATE ON SCHEMA public TO ${sql(names.authority)}`;
          }
        }).pipe(Effect.provide(migration));
        yield* install === undefined ? installCandidate : install(database);
        return yield* run(database);
      })
    ).pipe(Effect.provide(PgClient.layer(profile(adminUrl, "test-admin"))));
  });
