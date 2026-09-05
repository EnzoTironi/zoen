import {
  Blocked,
  Expired,
  InvalidInput,
  Unauthenticated,
} from "@zoen/contracts/d01/errors";
import { D01_LIMITS } from "@zoen/contracts/d01/values";
import { DateTime, Effect, Schema } from "effect";

import { VerifiedRequestContext } from "../ports/d01/context.js";

export const validateContext = Effect.fn("authority.access.validateContext")(
  function* validateContext(input: unknown) {
    const context = yield* Schema.decodeUnknownEffect(VerifiedRequestContext)(
      input
    ).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
    const now = DateTime.formatIso(yield* DateTime.now);
    if (
      context.presence.authenticatedAt > now ||
      context.presence.expiresAt <= now
    ) {
      return yield* new Unauthenticated({ code: "PRESENCE_REQUIRED" });
    }
    if (context.presence.realm !== "live") {
      return yield* new Blocked({ code: "PROFILE_BLOCKED" });
    }
    if (context.deadline <= now) {
      return yield* new Expired({ code: "EXPIRED" });
    }
    const maximum = DateTime.formatIso(
      DateTime.add(yield* DateTime.now, {
        seconds: D01_LIMITS.requestSeconds,
      })
    );
    if (context.deadline > maximum) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    return context;
  }
);

/** Interrupt request work at its absolute deadline, including SQL lock waits. */
export const withinRequestDeadline =
  (context: VerifiedRequestContext) =>
  <A, E, R>(body: Effect.Effect<A, E, R>) =>
    Effect.gen(function* requestDeadline() {
      yield* validateContext(context);
      const remaining =
        Date.parse(context.deadline) -
        Date.parse(DateTime.formatIso(yield* DateTime.now));
      if (remaining <= 0) {
        return yield* new Expired({ code: "EXPIRED" });
      }
      return yield* body.pipe(
        Effect.timeoutOrElse({
          duration: remaining,
          orElse: () => Effect.fail(new Expired({ code: "EXPIRED" })),
        })
      );
    });
