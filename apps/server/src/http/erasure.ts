import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { ApplicationApi } from "@zoen/contracts/worlds/api";
import { Expired } from "@zoen/contracts/worlds/errors";
import { D01_LIMITS } from "@zoen/contracts/worlds/values";
import { Effect, Redacted, Scope } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { makePrivateJsonEmitter } from "./disclosure.ts";
import { checkRequestAudience, readJsonBody } from "./request.ts";

export const makeErasureHttpGroup = (publicUrl: URL) =>
  HttpApiBuilder.group(
    ApplicationApi,
    "erasure",
    Effect.fn("http.makeErasureGroup")(function* makeErasureGroup(handlers) {
      const executor = yield* SemanticExecutor;
      return handlers.handleRaw(
        "execute",
        ({ request }) =>
          Effect.gen(function* executeErasureRequest() {
            yield* checkRequestAudience(request, publicUrl);
            const bytes = yield* readJsonBody(request);
            const requestScope = yield* Scope.Scope;
            const emit = yield* makePrivateJsonEmitter(request);
            yield* executor
              .executeErasureWithEmission(
                Redacted.make(request.headers.cookie ?? ""),
                bytes,
                emit
              )
              .pipe(Scope.provide(requestScope));
            return HttpServerResponse.empty({ status: 200 });
          }).pipe(
            Effect.timeoutOrElse({
              duration: D01_LIMITS.requestSeconds * 1000,
              orElse: () => Effect.fail(new Expired({ code: "EXPIRED" })),
            })
          ),
        { uninterruptible: false }
      );
    })
  );
