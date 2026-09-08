import { ApplicationApi } from "@zoen/contracts/worlds/api";
import { Expired } from "@zoen/contracts/worlds/errors";
import { WorldLimits } from "@zoen/contracts/worlds/values";
import { SemanticExecutor } from "@zoen/ontology/semantic/executor";
import { Effect, Redacted, Scope } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { makePrivateJsonEmitter } from "./disclosure.ts";
import { checkRequestAudience, readJsonBody } from "./request.ts";

export const makeCorrectionHttpGroup = (publicUrl: URL) =>
  HttpApiBuilder.group(
    ApplicationApi,
    "corrections",
    Effect.fn("http.makeCorrectionGroup")(
      function* makeCorrectionGroup(handlers) {
        const executor = yield* SemanticExecutor;
        return handlers.handleRaw(
          "execute",
          ({ request }) =>
            Effect.gen(function* executeCorrectionRequest() {
              yield* checkRequestAudience(request, publicUrl);
              const bytes = yield* readJsonBody(request);
              const requestScope = yield* Scope.Scope;
              const emit = yield* makePrivateJsonEmitter(request);
              yield* executor
                .executeCorrectionWithEmission(
                  Redacted.make(request.headers.cookie ?? ""),
                  bytes,
                  emit
                )
                .pipe(Scope.provide(requestScope));
              return HttpServerResponse.empty({ status: 200 });
            }).pipe(
              Effect.timeoutOrElse({
                duration: WorldLimits.requestSeconds * 1000,
                orElse: () => Effect.fail(new Expired({ code: "EXPIRED" })),
              })
            ),
          { uninterruptible: false }
        );
      }
    )
  );
