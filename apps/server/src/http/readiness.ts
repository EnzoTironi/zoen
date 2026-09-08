import { probeRestoredContentServingReadiness } from "@zoen/ontology/access/erasure/restore";
import { DisclosureFence } from "@zoen/ontology/ports/disclosure/fence";
import { ErasureRestoreActivation } from "@zoen/ontology/ports/erasure/restore-activation";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import { S3Health } from "../adapters/object-storage/worlds/health.ts";
import { checkAuthorityRole } from "../adapters/postgres/worlds/authority-role.ts";
import { IdentityAuth } from "../identity/worlds/identity.ts";

export const readinessRoutes = Layer.effectDiscard(
  Effect.gen(function* buildReadinessRoutes() {
    const router = yield* HttpRouter.HttpRouter;
    const sql = yield* SqlClient.SqlClient;
    const identity = yield* IdentityAuth;
    const storage = yield* S3Health;
    const disclosure = yield* DisclosureFence;
    // Satisfy Layer context: restore activation is provided by infrastructure.
    const restoreActivation = yield* ErasureRestoreActivation;
    const infrastructure = Effect.all(
      [
        checkAuthorityRole.pipe(
          Effect.provideService(SqlClient.SqlClient, sql)
        ),
        identity.checkHealth,
        storage.check,
        disclosure.checkHealth,
      ],
      { concurrency: 4, discard: true }
    ).pipe(Effect.timeout("3 seconds"));
    // Boot-time: infrastructure only. Quarantine must not abort layer construction.
    yield* infrastructure;
    /** ZA-13: content-serving readiness via authority probe (no duplicated policy). */
    const contentServing = probeRestoredContentServingReadiness().pipe(
      Effect.provideService(ErasureRestoreActivation, restoreActivation)
    );
    const readyCheck = Effect.all([infrastructure, contentServing], {
      concurrency: 2,
      discard: true,
    });
    yield* router.add(
      "GET",
      "/ready",
      readyCheck.pipe(
        Effect.as(HttpServerResponse.jsonUnsafe({ status: "ready" })),
        Effect.orElseSucceed(() =>
          HttpServerResponse.jsonUnsafe(
            { status: "unavailable" },
            { status: 503 }
          )
        )
      )
    );
  })
);
