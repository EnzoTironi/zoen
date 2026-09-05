import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { D01Api } from "@zoen/contracts/d01/api";
import { Expired } from "@zoen/contracts/d01/errors";
import { D01_LIMITS } from "@zoen/contracts/d01/values";
import { Effect, Redacted } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { checkRequestAudience, readJsonBody } from "./request.ts";

export const makeCorrectionHttpGroup = (publicUrl: URL) =>
  HttpApiBuilder.group(
    D01Api,
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
              return yield* executor.executeCorrection(
                Redacted.make(request.headers.cookie ?? ""),
                bytes
              );
            }).pipe(
              Effect.timeoutOrElse({
                duration: D01_LIMITS.requestSeconds * 1000,
                orElse: () => Effect.fail(new Expired({ code: "EXPIRED" })),
              })
            ),
          { uninterruptible: false }
        );
      }
    )
  );
