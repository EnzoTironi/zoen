import { SUBJECT_IDENTITY_LIMITS } from "@zoen/contracts/subject-identity/values";
import { QuotaExceeded } from "@zoen/contracts/worlds/errors";
import type { SubjectKey, WorldRef } from "@zoen/contracts/worlds/values";
import { Effect } from "effect";

import { readClaims } from "../../worlds/claims.js";

/** Authorized closure members only; caller supplies the closed anchor set. */
export const readClosureClaims = Effect.fn("subjectIdentity.readClosureClaims")(
  function* readClosureClaims(
    world: WorldRef,
    anchors: readonly (typeof SubjectKey.Type)[]
  ) {
    const entries = [];
    for (const anchor of anchors) {
      const batch = yield* readClaims(world, anchor);
      entries.push(...batch);
      if (entries.length > SUBJECT_IDENTITY_LIMITS.claims) {
        return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
      }
    }
    const byClaim = new Map(
      entries.map((entry) => [entry.claim.claimRef, entry] as const)
    );
    if (byClaim.size > SUBJECT_IDENTITY_LIMITS.claims) {
      return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
    }
    return [...byClaim.values()].toSorted((left, right) =>
      left.claim.claimRef < right.claim.claimRef ? -1 : 1
    );
  }
);
