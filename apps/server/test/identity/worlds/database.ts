import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { Effect, FileSystem, Layer, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeDisclosureFenceLayer } from "../../../src/adapters/postgres/disclosure/fence.ts";
import type { D01IdentityConfig } from "../../../src/identity/worlds/configuration.ts";
import { grantD01IdentityRole } from "../../../src/identity/worlds/grants.ts";
import { makeD01IdentityLayer } from "../../../src/identity/worlds/identity.ts";
import { withD01Database } from "../../adapters/postgres/worlds/database.ts";

type Database = Parameters<Parameters<typeof withD01Database>[0]>[0];
export const makeTestIdentityLayer = (
  config: D01IdentityConfig,
  database: Database
) =>
  makeD01IdentityLayer(config).pipe(
    Layer.provideMerge(
      makeDisclosureFenceLayer({
        applicationName: "zoen-ex22-identity-fence",
        maxConnections: 4,
        url: database.urls.authority,
      })
    )
  );

interface Options {
  readonly sessionSeconds?: number;
  readonly secure?: boolean;
}

export const withD01IdentityDatabase = <A, E, R>(
  run: (fixture: {
    readonly database: Database;
    readonly config: {
      readonly baseUrl: string;
      readonly databaseUrl: Redacted.Redacted;
      readonly secret: Redacted.Redacted;
      readonly sessionSeconds: number;
    };
    readonly runtime: ReturnType<typeof makeTestIdentityLayer>;
  }) => Effect.Effect<A, E, R>,
  options: Options = {}
) =>
  withD01Database((database) =>
    Effect.gen(function* prepareIdentity() {
      const info = yield* Effect.gen(function* connectionInfo() {
        const pg = yield* PgClient.PgClient;
        const [role] = yield* pg`SELECT current_user AS name`.pipe(
          Effect.flatMap(
            Schema.decodeUnknownEffect(
              Schema.Tuple([Schema.Struct({ name: Schema.NonEmptyString })])
            )
          )
        );
        if (pg.config.url === undefined) {
          throw new Error("EX06 fixture must provide a connection URL");
        }
        return { role: role.name, url: pg.config.url };
      }).pipe(Effect.provide(database.identity));
      const source = yield* FileSystem.FileSystem.use((fs) =>
        fs.readFileString(
          fileURLToPath(
            new URL("../../../src/identity/worlds/schema.sql", import.meta.url)
          )
        )
      ).pipe(Effect.provide(NodeFileSystem.layer));
      yield* Effect.gen(function* migration() {
        const sql = yield* SqlClient.SqlClient;
        yield* sql.withTransaction(sql.unsafe(source));
        yield* grantD01IdentityRole(info.role);
      }).pipe(Effect.provide(database.migration));
      const config = {
        baseUrl:
          options.secure === true
            ? "https://auth.zoen.test"
            : "http://localhost:3000",
        databaseUrl: info.url,
        secret: Redacted.make(randomBytes(32).toString("hex")),
        sessionSeconds: options.sessionSeconds ?? 3600,
      };
      return yield* run({
        config,
        database,
        runtime: makeTestIdentityLayer(config, database),
      });
    })
  );
