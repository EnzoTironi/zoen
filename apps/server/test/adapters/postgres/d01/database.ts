import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import { PgClient } from "@effect/sql-pg";
import { Config, Effect, Redacted } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { grantD01Roles } from "../../../../sql/proposals/d01/grants.ts";
import { makeD01PostgresLayer } from "../../../../src/adapters/postgres/d01/postgres.ts";

const profile = (url: Redacted.Redacted, name: string) => ({
  applicationName: `zoen-ex06-${name}`,
  maxConnections: 4,
  url,
});

/** Real dedicated PostgreSQL database. Only this invocation's resources are removed. */
export const withD01Database = <A, E, R>(
  run: (database: {
    readonly authority: ReturnType<typeof makeD01PostgresLayer>;
    readonly identity: ReturnType<typeof makeD01PostgresLayer>;
    readonly progress: ReturnType<typeof makeD01PostgresLayer>;
    readonly migration: ReturnType<typeof PgClient.layer>;
  }) => Effect.Effect<A, E, R>
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
    const schema = yield* Effect.tryPromise(() =>
      readFile(
        new URL("../../../../sql/proposals/d01/schema.sql", import.meta.url),
        "utf-8"
      )
    );
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
                `CREATE ROLE "${names[role]}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords[role]}'`
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
        yield* Effect.gen(function* migrate() {
          const sql = yield* SqlClient.SqlClient;
          yield* sql.withTransaction(sql.unsafe(schema));
          yield* grantD01Roles(names);
        }).pipe(Effect.provide(migration));
        return yield* run({
          authority: makeD01PostgresLayer(
            profile(roleUrl("authority"), "authority")
          ),
          identity: makeD01PostgresLayer(
            profile(roleUrl("identity"), "identity")
          ),
          migration,
          progress: makeD01PostgresLayer(
            profile(roleUrl("progress"), "progress")
          ),
        });
      })
    ).pipe(Effect.provide(PgClient.layer(profile(adminUrl, "test-admin"))));
  });
