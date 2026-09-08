import { DisclosureFence } from "@zoen/authority/ports/disclosure/fence";
import { ErasureRestoreActivation } from "@zoen/authority/ports/erasure/restore-activation";
import {
  allowsContentServingReadiness,
  currentRestoreActivationQualification,
} from "@zoen/authority/ports/erasure/restore-activation-laws";
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
    /** ZA-13: content-serving readiness stays closed under restore quarantine / unknown rights. */
    const contentServing = Effect.gen(function* contentReady() {
      const observation = yield* restoreActivation.observe;
      const qualification = yield* restoreActivation.qualification;
      // Object Lock never elevates restoreAfterErasure (stays Unknown).
      if (qualification.objectLockRestoreAfterErasure !== "Unknown") {
        return yield* Effect.fail(
          "restore-after-erasure-not-qualified" as const
        );
      }
      const frozen = currentRestoreActivationQualification();
      if (
        frozen.h01 !== "Blocked" ||
        frozen.gOps !== "Unknown" ||
        frozen.gStorageFence !== "Blocked"
      ) {
        // Defensive: composition must not invent gate clearance.
        return yield* Effect.fail("gates-misreported" as const);
      }
      const rightsKnown = observation.phase === "NotRestored";
      if (
        !allowsContentServingReadiness({
          controllerFresh: true,
          phase: observation.phase,
          qualification,
          rightsKnown,
        })
      ) {
        return yield* Effect.fail("restore-quarantine" as const);
      }
      return yield* Effect.void;
    });
    const check = Effect.all([infrastructure, contentServing], {
      concurrency: 2,
      discard: true,
    });
    yield* check;
    yield* router.add(
      "GET",
      "/ready",
      check.pipe(
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
