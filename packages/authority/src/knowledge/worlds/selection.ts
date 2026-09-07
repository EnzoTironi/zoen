import { InvalidInput } from "@zoen/contracts/worlds/errors";
import { VisibleClaim } from "@zoen/contracts/worlds/evidence";
import type { Selection } from "@zoen/contracts/worlds/evidence";
import { WorldLimits } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import { compareAmounts } from "../../values/amount.js";
import { intervalRelation } from "../../values/time.js";

const Claims = Schema.Array(VisibleClaim).check(
  Schema.isMaxLength(WorldLimits.frameClaims)
);

const pairConflicts = Effect.fn("authority.knowledge.pairConflicts")(
  function* pairConflicts(left: VisibleClaim, right: VisibleClaim) {
    if (
      left.subjectKey !== right.subjectKey ||
      left.predicate !== right.predicate ||
      left.value._tag !== "Known" ||
      right.value._tag !== "Known" ||
      (yield* intervalRelation(left.validTime, right.validTime)) !==
        "Overlapping"
    ) {
      return false;
    }
    const comparison = yield* compareAmounts(
      { amount: left.value.amount, currency: left.value.currency },
      { amount: right.value.amount, currency: right.value.currency }
    );
    return comparison._tag === "Comparable" && comparison.order !== 0;
  }
);

export const classifyClaims = Effect.fn("authority.knowledge.classifyClaims")(
  function* classifyClaims(
    input: readonly VisibleClaim[]
  ): Effect.fn.Return<
    { readonly contested: boolean; readonly selection: typeof Selection.Type },
    InvalidInput
  > {
    const claims = yield* Schema.decodeEffect(Claims)(input).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    let contested = false;
    for (const [index, left] of claims.entries()) {
      for (const right of claims.slice(index + 1)) {
        if (yield* pairConflicts(left, right)) {
          contested = true;
        }
      }
    }
    const known = claims.filter((claim) => claim.value._tag === "Known");
    if (known.length === 0) {
      return { contested, selection: { _tag: "unknown" } };
    }
    if (contested || known.length !== claims.length) {
      return { contested, selection: { _tag: "unresolved" } };
    }
    const [single] = known;
    if (known.length === 1 && single !== undefined) {
      return {
        contested,
        selection: { _tag: "selected", claimRef: single.claimRef },
      };
    }
    return {
      contested,
      selection: {
        _tag: "set-valued",
        claimRefs: known.map((claim) => claim.claimRef),
      },
    };
  }
);
