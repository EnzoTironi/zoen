import type { Unavailable } from "@zoen/contracts/worlds/errors";
import { Context } from "effect";
import type { Effect } from "effect";

import type { PrincipalId } from "../worlds/context.js";

/** Exact account eligibility; no directory, session or identity metadata. */
export class PrincipalDirectory extends Context.Service<
  PrincipalDirectory,
  {
    readonly exists: (
      principalId: typeof PrincipalId.Type
    ) => Effect.Effect<boolean, Unavailable>;
  }
>()("zoen/ontology/ports/sharing/PrincipalDirectory") {}
