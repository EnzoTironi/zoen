import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { ApplicationApi } from "@zoen/contracts/d01/api";
import { Expired } from "@zoen/contracts/d01/errors";
import { D01_LIMITS } from "@zoen/contracts/d01/values";
import { Effect, Redacted, Scope } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { makePrivateJsonEmitter } from "./disclosure.ts";
import { checkRequestAudience, readJsonBody } from "./request.ts";

export const makeEveHttpGroup = (publicUrl: URL) =>
  HttpApiBuilder.group(
    ApplicationApi,
    "eve",
    Effect.fn("http.makeEveGroup")(function* makeEveGroup(handlers) {
      const executor = yield* SemanticExecutor;
      return handlers.handleRaw(
        "execute",
        ({ request }) =>
          Effect.gen(function* executeEveRequest() {
            yield* checkRequestAudience(request, publicUrl);
            const bytes = yield* readJsonBody(request);
            const requestScope = yield* Scope.Scope;
            const emit = yield* makePrivateJsonEmitter(request);
            yield* executor
              .executeEveWithEmission(
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
