import { InvalidInput } from "@zoen/contracts/d01/errors";
import type { WorldRef } from "@zoen/contracts/d01/values";
import {
  GrantWorldReadAccess,
  InspectWorldAccess,
  RevokeWorldReadAccess,
} from "@zoen/contracts/sharing/operations";
import { Effect, Schema } from "effect";

import { newOperationId } from "../d01/requests.ts";
import type { AccessTarget } from "./model.ts";

const envelope = {
  purpose: "personal-records",
  schemaVersion: "d03.sharing.v1",
} as const;
export const inspectAccessRequest = (
  worldRef: WorldRef,
  principalRef: string | null
) =>
  Schema.decodeEffect(InspectWorldAccess)({
    ...envelope,
    input: { principalRef },
    operation: "InspectWorldAccess",
    worldRef,
  }).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));

/** Called only by explicit confirmation. Retry retains the resulting request unchanged. */
export const confirmAccessRequest = Effect.fn("web.confirmAccessRequest")(
  function* confirmAccessRequest(
    worldRef: WorldRef,
    target: AccessTarget,
    action: "grant" | "revoke"
  ) {
    const expectedRevision = target.membership?.revision ?? null;
    return yield* Schema.decodeUnknownEffect(
      action === "grant" ? GrantWorldReadAccess : RevokeWorldReadAccess
    )({
      ...envelope,
      input: { expectedRevision, principalRef: target.principalRef },
      operation:
        action === "grant" ? "GrantWorldReadAccess" : "RevokeWorldReadAccess",
      operationId: yield* newOperationId,
      worldRef,
    }).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
  }
);
