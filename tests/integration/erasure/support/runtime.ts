import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";

import { makeDisclosureFenceLayer } from "../../../../apps/server/src/adapters/postgres/disclosure/fence.ts";
import { makeD01PostgresLayer } from "../../../../apps/server/src/adapters/postgres/worlds/postgres.ts";
import type { D01TestDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { withD01Database } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { applyErasureMigrations } from "../../../../ops/migrations/run.ts";
import { localErasureAttemptRegisterLayer } from "../../../../packages/authority/src/ports/erasure/local-pg.ts";
import { erasableConfiguration } from "../core/fixture.ts";

/** Numbered migrations, real roles, real register and real disclosure connections. */
export const withErasureRuntime = <A, E, R>(
  run: (database: D01TestDatabase) => Effect.Effect<A, E, R>
) =>
  withD01Database(
    (database) => {
      const register = localErasureAttemptRegisterLayer.pipe(
        Layer.provide(
          makeD01PostgresLayer({
            applicationName: "zoen-erasure-register-test",
            maxConnections: 4,
            url: database.urls.authority,
          })
        )
      );
      const fence = makeDisclosureFenceLayer({
        applicationName: "zoen-erasure-disclosure-test",
        maxConnections: 4,
        url: database.urls.authority,
      });
      return run(database).pipe(
        Effect.provide(
          Layer.mergeAll(
            erasableConfiguration,
            database.authority,
            register,
            fence
          )
        )
      );
    },
    undefined,
    (database) =>
      applyErasureMigrations(database.names).pipe(
        Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
      )
  );
