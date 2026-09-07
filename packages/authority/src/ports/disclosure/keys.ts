import type { WorldRef } from "@zoen/contracts/worlds/values";

import type { PrincipalId, VerifiedPresence } from "../worlds/context.js";

/** Readers and writers hash these same names in the same physical PostgreSQL. */
export const sessionDisclosureKey = (presence: VerifiedPresence): string =>
  `zoen:disclosure:session:v1:${JSON.stringify([
    presence.realm,
    presence.principalId,
    presence.sessionId,
  ])}`;

export const membershipDisclosureKey = (
  world: WorldRef,
  principalId: typeof PrincipalId.Type
): string =>
  `zoen:disclosure:membership:v1:${JSON.stringify([
    world.realm,
    world.worldId,
    principalId,
  ])}`;
