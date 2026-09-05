import type { InvalidInput, QuotaExceeded } from "@zoen/contracts/d01/errors";
import type { SemanticRequest } from "@zoen/contracts/d01/operations";
import type { Digest } from "@zoen/contracts/d01/values";
import { Effect } from "effect";

import { intentDigest } from "../values/canonical.js";

export type WorldMutation = Extract<
  SemanticRequest,
  { readonly operationId: string; readonly worldRef: unknown }
>;
export interface BoundWorldIntent {
  readonly request: WorldMutation;
  readonly digest: typeof Digest.Type;
}

export const bindWorldIntent = Effect.fn("authority.commit.bindWorldIntent")(
  function* bindWorldIntent(
    request: WorldMutation
  ): Effect.fn.Return<BoundWorldIntent, InvalidInput | QuotaExceeded> {
    return { digest: yield* intentDigest(request), request };
  }
);
