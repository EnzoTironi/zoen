import { Blocked } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import { authorizeWorld } from "../access/world.js";
import { DataPolicy, DataPolicySchema } from "../ports/worlds/context.js";
import type { VerifiedRequestContext } from "../ports/worlds/context.js";

export const requireImportPolicy = Effect.fn(
  "authority.evidence.requireImportPolicy"
)(function* requireImportPolicy(
  context: VerifiedRequestContext,
  world: WorldRef
) {
  const policy = yield* Schema.decodeEffect(DataPolicySchema)(
    yield* DataPolicy
  ).pipe(Effect.mapError(() => new Blocked({ code: "PROFILE_BLOCKED" })));
  if (world.realm !== policy.enabledRealm) {
    return yield* new Blocked({ code: "PROFILE_BLOCKED" });
  }
  yield* authorizeWorld(context, world);
  return policy;
});
