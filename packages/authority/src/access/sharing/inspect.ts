import { InvalidInput, Unavailable } from "@zoen/contracts/d01/errors";
import {
  InspectWorldAccess,
  WorldAccessInspected,
} from "@zoen/contracts/sharing/operations";
import { Effect, Schema } from "effect";

import type { VerifiedRequestContext } from "../../ports/d01/context.js";
import { authorizeWorld } from "../world.js";
import { principalIdFromRef, readMembership } from "./membership.js";

export const inspectWorldAccess = Effect.fn(
  "authority.sharing.inspectWorldAccess"
)(function* inspectWorldAccess(
  context: VerifiedRequestContext,
  input: typeof InspectWorldAccess.Type
) {
  const request = yield* Schema.decodeEffect(InspectWorldAccess)(input).pipe(
    Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
  );
  const target =
    request.input.principalRef === null
      ? context.presence.principalId
      : yield* principalIdFromRef(request.input.principalRef);
  const capability =
    target === context.presence.principalId ? "read" : "manage";
  yield* authorizeWorld(context, request.worldRef, capability);
  const membership = yield* readMembership(request.worldRef, target);
  yield* authorizeWorld(context, request.worldRef, capability);
  return yield* Schema.decodeEffect(WorldAccessInspected)({
    _tag: "WorldAccessInspected",
    membership,
    worldRef: request.worldRef,
  }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
});
