import type { Expired, Unavailable } from "@zoen/contracts/d01/errors";
import type { Instant, WorldRef } from "@zoen/contracts/d01/values";
import { Context } from "effect";
import type { Effect, Scope } from "effect";

import type { VerifiedPresence } from "../d01/context.js";

/** Only a trusted emitter may acknowledge completion or prove it cannot begin. */
export interface DisclosurePermit {
  readonly acknowledge: Effect.Effect<void, Unavailable>;
}

/** Physical coordination only; authorization remains in the semantic executor. */
export class DisclosureFence extends Context.Service<
  DisclosureFence,
  {
    readonly shared: (
      presence: VerifiedPresence,
      world: WorldRef,
      deadline: typeof Instant.Type
    ) => Effect.Effect<DisclosurePermit, Expired | Unavailable, Scope.Scope>;
    readonly exclusiveSession: (
      presence: VerifiedPresence,
      deadline: typeof Instant.Type
    ) => Effect.Effect<void, Expired | Unavailable, Scope.Scope>;
    readonly checkHealth: Effect.Effect<void, Unavailable>;
  }
>()("zoen/authority/ports/disclosure/Fence") {}
