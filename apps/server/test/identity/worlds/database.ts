import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeFileSystem } from "@effect/platform-node";
import { PgClient } from "@effect/sql-pg";
import { Effect, FileSystem, Layer, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { makeDisclosureFenceLayer } from "../../../src/adapters/postgres/disclosure/fence.ts";
import type { IdentityConfig } from "../../../src/identity/worlds/configuration.ts";
import { grantIdentityRole } from "../../../src/identity/worlds/grants.ts";
import { makeIdentityLayer } from "../../../src/identity/worlds/identity.ts";
import { withWorldsDatabase } from "../../adapters/postgres/worlds/database.ts";

type Database = Parameters<Parameters<typeof withWorldsDatabase>[0]>[0];
export const makeTestIdentityLayer = (
  config: IdentityConfig,
  database: Database
) =>
  makeIdentityLayer(config).pipe(
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

export const withIdentityDatabase = <A, E, R>(
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
  withWorldsDatabase((database) =>
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
        yield* grantIdentityRole(info.role);
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
