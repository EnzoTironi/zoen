import type { EveGroundedBasis } from "@zoen/contracts/eve/tools";
import type {
  Blocked,
  Conflict,
  InvalidInput,
  NotFoundOrDenied,
  Unavailable,
} from "@zoen/contracts/worlds/errors";
import { Blocked as BlockedError } from "@zoen/contracts/worlds/errors";
import type { SubjectKey, WorldRef } from "@zoen/contracts/worlds/values";
import { Context, Effect, Layer } from "effect";
import type { Effect as EffectType } from "effect";

import type { VerifiedRequestContext } from "../worlds/context.js";
import type { EveJournal } from "./journal.js";
import type { EveOpenCodeZen } from "./opencode-zen.js";
import type { RunEveTurnInput, RunEveTurnResult } from "./turn.js";
import { runEveTurn } from "./turn.js";

type TurnFailure =
  | Blocked
  | Conflict
  | InvalidInput
  | NotFoundOrDenied
  | Unavailable;

export interface GroundSubjectInput {
  readonly context: VerifiedRequestContext;
  readonly subjectKey: typeof SubjectKey.Type;
  readonly worldRef: WorldRef;
}

/**
 * Server-owned turn orchestration port (ZA-19).
 * Product composition installs the grounded implementation from apps/server/eve.
 * Ontology keeps this port + a legacy offline layer that wraps `runEveTurn`
 * without domain-tool grounding (unit proofs only).
 */
export class EveTurnService extends Context.Service<
  EveTurnService,
  {
    /**
     * Run accept→model→settle. Grounded composition may invoke admitted
     * domain tools (Inspect) via the shared semantic path before settle.
     */
    readonly run: (
      input: RunEveTurnInput
    ) => EffectType.Effect<
      RunEveTurnResult,
      TurnFailure,
      EveJournal | EveOpenCodeZen
    >;
    /**
     * Evidence-bound Inspect through the shared domain path (same facts as UI).
     * Does not call a model and does not settle journal rows.
     */
    readonly groundSubject: (
      input: GroundSubjectInput
    ) => EffectType.Effect<EveGroundedBasis, TurnFailure>;
  }
>()("zoen/ontology/ports/eve/EveTurnService") {
  /**
   * Offline unit path: model turn without domain tools; grounding unavailable.
   * Product composition must not use this layer.
   */
  static readonly legacyWithoutGroundingLayer = Layer.succeed(
    EveTurnService,
    EveTurnService.of({
      groundSubject: () =>
        Effect.fail(new BlockedError({ code: "PROFILE_BLOCKED" })),
      run: (input) => runEveTurn(input),
    })
  );
}
