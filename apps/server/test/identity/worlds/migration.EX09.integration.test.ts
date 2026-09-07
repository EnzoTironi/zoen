import { expect, it } from "@effect/vitest";
import { getMigrations } from "better-auth/db/migration";
import { Effect, Schema } from "effect";

import {
  IdentityConfig,
  identityAuthOptions,
} from "../../../src/identity/worlds/configuration.ts";
import { acquireIdentityPool } from "../../../src/identity/worlds/database.ts";
import { withIdentityDatabase } from "./database.ts";

it.live(
  "EX09 applied identity schema has no outstanding Better Auth migrations",
  () =>
    withIdentityDatabase((fixture) =>
      Effect.gen(function* migrationCompatibility() {
        const config = yield* Schema.decodeEffect(IdentityConfig)(
          fixture.config
        );
        const pool = yield* acquireIdentityPool(config.databaseUrl);
        const pending = yield* Effect.tryPromise(() =>
          getMigrations(identityAuthOptions(config, pool))
        );
        expect({
          additions: pending.toBeAdded,
          creations: pending.toBeCreated,
          indexes: pending.toBeAddedIndexes,
          unsafe: pending.unsafeChanges,
        }).toStrictEqual({
          additions: [],
          creations: [],
          indexes: [],
          unsafe: [],
        });
      })
    )
);
