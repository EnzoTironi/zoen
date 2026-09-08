import { NodeServices } from "@effect/platform-node";
import { Effect, Layer } from "effect";

import { makeDisclosureFenceLayer } from "../../../../apps/server/src/adapters/postgres/disclosure/fence.ts";
import { makeWorldsPostgresLayer } from "../../../../apps/server/src/adapters/postgres/worlds/postgres.ts";
import type { WorldsTestDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.ts";
import { applyErasureMigrations } from "../../../../ops/migrations/run.ts";
import { localErasureCopyCatalogLayer } from "../../../../packages/ontology/src/ports/erasure/copy-catalog-pg.ts";
import { ErasureCopyCatalog } from "../../../../packages/ontology/src/ports/erasure/copy-catalog.ts";
import { localErasureAttemptRegisterLayer } from "../../../../packages/ontology/src/ports/erasure/local-pg.ts";
import { erasableConfiguration } from "../core/fixture.ts";

/** Numbered migrations, real roles, real register and real disclosure connections. */
export const withErasureRuntime = <A, E, R>(
  run: (database: WorldsTestDatabase) => Effect.Effect<A, E, R>
) =>
  withWorldsDatabase(
    (database) => {
      const authorityPg = makeWorldsPostgresLayer({
        applicationName: "zoen-erasure-register-test",
        maxConnections: 4,
        url: database.urls.authority,
      });
      const register = localErasureAttemptRegisterLayer.pipe(
        Layer.provide(authorityPg)
      );
      const copyCatalog = localErasureCopyCatalogLayer.pipe(
        Layer.provide(database.authority)
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
            copyCatalog,
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

/** Empty BoundedComplete cut so purge may reach Erased under ZA-12 admission. */
export const admitEmptyCopyCatalog = (profileId = "worlds-local-erasable-v1") =>
  Effect.gen(function* admit() {
    const catalog = yield* ErasureCopyCatalog;
    yield* catalog.setCoverage(
      profileId,
      "BoundedComplete",
      `test/admit-empty/${profileId}`
    );
  });
