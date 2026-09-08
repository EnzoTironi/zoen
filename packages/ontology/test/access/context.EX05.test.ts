import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect } from "effect";

import { validateContext } from "../../src/access/context.js";

const principalId = "00000000-0000-4000-8000-000000000001";
const contextAt = (now: DateTime.Utc) => ({
  deadline: DateTime.formatIso(DateTime.add(now, { seconds: 30 })),
  presence: {
    authenticatedAt: DateTime.formatIso(
      DateTime.subtract(now, { seconds: 10 })
    ),
    expiresAt: DateTime.formatIso(DateTime.add(now, { seconds: 60 })),
    principalId,
    realm: "live",
    sessionId: "unit-presence-contract",
  },
  purpose: "personal-records",
});

describe("EX05 verified context boundary", () => {
  it.effect("accepts a bounded currently valid live context", () =>
    Effect.gen(function* validContext() {
      const context = contextAt(yield* DateTime.now);
      expect(yield* validateContext(context)).toStrictEqual(context);
    })
  );
  it.effect("rejects expiration at the exact boundary", () =>
    Effect.gen(function* expiredPresence() {
      const now = yield* DateTime.now;
      const context = contextAt(now);
      context.presence.expiresAt = DateTime.formatIso(now);
      const error = yield* validateContext(context).pipe(Effect.flip);
      expect(error._tag).toBe("Unauthenticated");
    })
  );
  it.effect("rejects an expired deadline and an excessive deadline", () =>
    Effect.gen(function* boundedDeadline() {
      const now = yield* DateTime.now;
      const context = contextAt(now);
      context.deadline = DateTime.formatIso(now);
      expect((yield* validateContext(context).pipe(Effect.flip))._tag).toBe(
        "Expired"
      );
      context.deadline = DateTime.formatIso(DateTime.add(now, { seconds: 31 }));
      expect((yield* validateContext(context).pipe(Effect.flip))._tag).toBe(
        "InvalidInput"
      );
    })
  );
  it.effect("blocks evaluation and rejects unrecognized context fields", () =>
    Effect.gen(function* strictLiveContext() {
      const context = contextAt(yield* DateTime.now);
      context.presence.realm = "evaluation";
      expect((yield* validateContext(context).pipe(Effect.flip))._tag).toBe(
        "Blocked"
      );
      expect(
        (yield* validateContext({ ...context, role: "owner" }).pipe(
          Effect.flip
        ))._tag
      ).toBe("InvalidInput");
    })
  );
});
