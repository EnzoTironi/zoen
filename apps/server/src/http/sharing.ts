import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { ApplicationApi } from "@zoen/contracts/d01/api";
import { Expired } from "@zoen/contracts/d01/errors";
import { D01_LIMITS } from "@zoen/contracts/d01/values";
import { Effect, Redacted, Scope } from "effect";
import { HttpServerResponse } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { checkRequestAudience, readJsonBody } from "./request.ts";

export const makeSharingHttpGroup = (publicUrl: URL) =>
  HttpApiBuilder.group(
    ApplicationApi,
    "sharing",
    Effect.fn("http.makeSharingGroup")(function* makeSharingGroup(handlers) {
      const executor = yield* SemanticExecutor;
      return handlers.handleRaw(
        "execute",
        ({ request }) =>
          Effect.gen(function* executeSharingRequest() {
            yield* checkRequestAudience(request, publicUrl);
            const bytes = yield* readJsonBody(request);
            const requestScope = yield* Scope.Scope;
            return yield* executor
              .executeSharingWithEmission(
                Redacted.make(request.headers.cookie ?? ""),
                bytes,
                (jsonBytes) =>
                  Effect.succeed(
                    HttpServerResponse.uint8Array(jsonBytes, {
                      contentType: "application/json",
                    })
                  )
              )
              .pipe(Scope.provide(requestScope));
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
