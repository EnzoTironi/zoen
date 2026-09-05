import { SemanticExecutor } from "@zoen/authority/semantic/executor";
import { D01Api } from "@zoen/contracts/d01/api";
import { Expired } from "@zoen/contracts/d01/errors";
import { D01_LIMITS } from "@zoen/contracts/d01/values";
import { Effect, Redacted } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { checkRequestAudience, readJsonBody } from "./request.ts";

export const makeD01HttpGroup = (publicUrl: URL) =>
  HttpApiBuilder.group(
    D01Api,
    "d01",
    Effect.fn("http.makeD01Group")(function* makeD01Group(handlers) {
      const executor = yield* SemanticExecutor;
      return handlers.handleRaw(
        "execute",
        ({ request }) =>
          Effect.gen(function* executeRequest() {
            yield* checkRequestAudience(request, publicUrl);
            const bytes = yield* readJsonBody(request);
            return yield* executor.execute(
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
    })
  );
