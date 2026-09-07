import { DisclosureFence } from "@zoen/authority/ports/disclosure/fence";
import { Effect, Layer } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";

import { S3Health } from "../adapters/object-storage/worlds/health.ts";
import { checkD01AuthorityRole } from "../adapters/postgres/worlds/authority-role.ts";
import { D01Auth } from "../identity/worlds/identity.ts";

export const readinessRoutes = Layer.effectDiscard(
  Effect.gen(function* buildReadinessRoutes() {
    const router = yield* HttpRouter.HttpRouter;
    const sql = yield* SqlClient.SqlClient;
    const identity = yield* D01Auth;
    const storage = yield* S3Health;
    const disclosure = yield* DisclosureFence;
    const check = Effect.all(
      [
        checkD01AuthorityRole.pipe(
          Effect.provideService(SqlClient.SqlClient, sql)
        ),
        identity.checkHealth,
        storage.check,
        disclosure.checkHealth,
      ],
      { concurrency: 4, discard: true }
    ).pipe(Effect.timeout("3 seconds"));
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
