import { InvalidInput } from "@zoen/contracts/d01/errors";
import {
  DateInterval,
  Purpose,
  Revision,
  WorldRef,
  exact,
} from "@zoen/contracts/d01/values";
import { PrincipalRef } from "@zoen/contracts/sharing/operations";
import { IdentityEffects } from "@zoen/contracts/subject-identity/effects";
import type { IdentityEffect } from "@zoen/contracts/subject-identity/effects";
import { IdentityDecisionRef } from "@zoen/contracts/subject-identity/values";
import { Effect, Schema } from "effect";

import { covers, subtractIntervals } from "./intervals.js";

export const IdentityScope = Schema.Struct({
  principalRef: PrincipalRef,
  purpose: Purpose,
  worldRef: WorldRef,
}).annotate(exact);
export type IdentityScope = typeof IdentityScope.Type;

/** Algorithm input, not a persistence schema or a client-supplied authority. */
export const IdentityDecision = Schema.Struct({
  authoredBy: PrincipalRef,
  decisionRef: IdentityDecisionRef,
  effectItems: IdentityEffects.check(Schema.isMinLength(1)),
  interval: DateInterval,
  kind: Schema.Literals(["resolution", "split", "undo"]),
  purpose: Purpose,
  revision: Revision,
  targetDecisionRef: Schema.NullOr(IdentityDecisionRef),
  worldRef: WorldRef,
})
  .check(
    Schema.makeFilter((decision) => {
      if (decision.kind === "undo") {
        return (
          decision.targetDecisionRef !== null &&
          decision.effectItems.every((item) => item._tag === "UndoEffect")
        );
      }
      return (
        decision.targetDecisionRef === null &&
        decision.effectItems.every(
          (item) =>
            item._tag !== "UndoEffect" &&
            covers(decision.interval, item.interval) &&
            (decision.kind !== "resolution" || item._tag === "Assert")
        )
      );
    })
  )
  .annotate(exact);
export type IdentityDecision = typeof IdentityDecision.Type;
type AssertEffect = Extract<IdentityEffect, { readonly _tag: "Assert" }>;
type WithdrawEffect = Extract<IdentityEffect, { readonly _tag: "Withdraw" }>;
export interface ProjectedAssertion {
  readonly assertion: AssertEffect;
  readonly decisionRef: typeof IdentityDecisionRef.Type;
  readonly effectiveIntervals: readonly (typeof DateInterval.Type)[];
  readonly withdrawals: readonly WithdrawEffect[];
}
export interface IdentityProjection {
  readonly assertions: readonly ProjectedAssertion[];
  readonly decisions: readonly IdentityDecision[];
  readonly undoneDecisionRefs: readonly (typeof IdentityDecisionRef.Type)[];
}
interface OwnedEffect {
  readonly decisionRef: typeof IdentityDecisionRef.Type;
  readonly effect: IdentityEffect;
}

const sameScope = (scope: IdentityScope, decision: IdentityDecision): boolean =>
  decision.authoredBy === scope.principalRef &&
  decision.purpose === scope.purpose &&
  decision.worldRef.realm === scope.worldRef.realm &&
  decision.worldRef.worldId === scope.worldRef.worldId;

const invalid = () => new InvalidInput({ code: "INVALID_INPUT" });

interface ProjectionState {
  readonly byDecision: Map<typeof IdentityDecisionRef.Type, IdentityDecision>;
  readonly effects: Map<IdentityEffect["effectRef"], OwnedEffect>;
  readonly assertions: Map<AssertEffect["assertionRef"], OwnedEffect>;
  readonly deactivated: Set<IdentityEffect["effectRef"]>;
  readonly undone: Set<typeof IdentityDecisionRef.Type>;
}

const applyUndo = Effect.fn("subjectIdentity.applyUndo")(function* applyUndo(
  state: ProjectionState,
  decision: IdentityDecision
) {
  const target =
    decision.targetDecisionRef === null
      ? undefined
      : state.byDecision.get(decision.targetDecisionRef);
  if (
    target === undefined ||
    target.kind === "undo" ||
    state.undone.has(target.decisionRef) ||
    target.interval.from !== decision.interval.from ||
    target.interval.to !== decision.interval.to
  ) {
    return yield* invalid();
  }
  const inverseRefs = decision.effectItems.flatMap((item) =>
    item._tag === "UndoEffect" ? [item.targetEffectRef] : []
  );
  if (
    new Set(inverseRefs).size !== target.effectItems.length ||
    inverseRefs.length !== target.effectItems.length ||
    target.effectItems.some((item) => !inverseRefs.includes(item.effectRef))
  ) {
    return yield* invalid();
  }
  for (const item of target.effectItems) {
    if (state.deactivated.has(item.effectRef)) {
      return yield* invalid();
    }
    if (
      item._tag === "Assert" &&
      [...state.effects.values()].some(
        (other) =>
          other.effect._tag === "Withdraw" &&
          other.effect.assertionRef === item.assertionRef &&
          !state.deactivated.has(other.effect.effectRef)
      )
    ) {
      return yield* invalid();
    }
    state.deactivated.add(item.effectRef);
  }
  state.undone.add(target.decisionRef);
  return null;
});

const appendEffect = Effect.fn("subjectIdentity.appendEffect")(
  function* appendEffect(
    state: ProjectionState,
    decisionRef: typeof IdentityDecisionRef.Type,
    effect: IdentityEffect
  ) {
    if (state.effects.has(effect.effectRef)) {
      return yield* invalid();
    }
    const owned = { decisionRef, effect };
    if (effect._tag === "Assert") {
      if (state.assertions.has(effect.assertionRef)) {
        return yield* invalid();
      }
      state.assertions.set(effect.assertionRef, owned);
    }
    if (effect._tag === "Withdraw") {
      const target = state.assertions.get(effect.assertionRef);
      if (
        target === undefined ||
        target.effect._tag !== "Assert" ||
        state.deactivated.has(target.effect.effectRef) ||
        !covers(target.effect.interval, effect.interval)
      ) {
        return yield* invalid();
      }
    }
    state.effects.set(effect.effectRef, owned);
    return null;
  }
);

/** The caller authorizes first. Hidden scopes never enter validation or projection. */
export const projectIdentity = Effect.fn("subjectIdentity.projectIdentity")(
  function* projectIdentity(
    scope: IdentityScope,
    input: readonly IdentityDecision[]
  ): Effect.fn.Return<IdentityProjection, InvalidInput> {
    yield* Schema.decodeEffect(IdentityScope)(scope).pipe(
      Effect.mapError(invalid)
    );
    const decisions: IdentityDecision[] = [];
    for (const candidate of input) {
      if (sameScope(scope, candidate)) {
        decisions.push(
          yield* Schema.decodeEffect(IdentityDecision)(candidate).pipe(
            Effect.mapError(invalid)
          )
        );
      }
    }
    decisions.sort((left, right) => {
      if (left.revision === right.revision) {
        return 0;
      }
      return BigInt(left.revision) < BigInt(right.revision) ? -1 : 1;
    });
    const state: ProjectionState = {
      assertions: new Map(),
      byDecision: new Map(),
      deactivated: new Set(),
      effects: new Map(),
      undone: new Set(),
    };
    const { byDecision, effects, assertions, deactivated, undone } = state;
    let previousRevision: typeof Revision.Type | undefined;
    for (const decision of decisions) {
      if (
        byDecision.has(decision.decisionRef) ||
        previousRevision === decision.revision
      ) {
        return yield* invalid();
      }
      previousRevision = decision.revision;
      if (decision.kind === "undo") {
        yield* applyUndo(state, decision);
      }
      for (const effect of decision.effectItems) {
        yield* appendEffect(state, decision.decisionRef, effect);
      }
      byDecision.set(decision.decisionRef, decision);
    }
    const projected: ProjectedAssertion[] = [];
    for (const owned of assertions.values()) {
      const assertion = owned.effect;
      if (assertion._tag !== "Assert" || deactivated.has(assertion.effectRef)) {
        continue;
      }
      const withdrawals = [...effects.values()].flatMap(({ effect }) =>
        effect._tag === "Withdraw" &&
        effect.assertionRef === assertion.assertionRef &&
        !deactivated.has(effect.effectRef)
          ? [effect]
          : []
      );
      projected.push({
        assertion,
        decisionRef: owned.decisionRef,
        effectiveIntervals: subtractIntervals(
          assertion.interval,
          withdrawals.map((item) => item.interval)
        ),
        withdrawals,
      });
    }
    return {
      assertions: projected,
      decisions,
      undoneDecisionRefs: [...undone],
    };
  }
);
