import { expect, it } from "@effect/vitest";
import { getMigrations } from "better-auth/db/migration";
import { Effect, Schema } from "effect";

import {
  D01IdentityConfig,
  d01AuthOptions,
} from "../../../src/identity/d01/configuration.ts";
import { acquireD01IdentityPool } from "../../../src/identity/d01/database.ts";
import { withD01IdentityDatabase } from "./database.ts";

it.live(
  "EX09 applied identity schema has no outstanding Better Auth migrations",
  () =>
    withD01IdentityDatabase((fixture) =>
      Effect.gen(function* migrationCompatibility() {
        const config = yield* Schema.decodeEffect(D01IdentityConfig)(
          fixture.config
        );
        const pool = yield* acquireD01IdentityPool(config.databaseUrl);
        const pending = yield* Effect.tryPromise(() =>
          getMigrations(d01AuthOptions(config, pool))
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
