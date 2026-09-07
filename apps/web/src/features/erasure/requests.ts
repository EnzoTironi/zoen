import {
  InspectWorldErasure,
  RequestWorldErasure,
} from "@zoen/contracts/erasure/operations";
import type { WorldErasureSuccess } from "@zoen/contracts/erasure/operations";
import { InvalidInput } from "@zoen/contracts/worlds/errors";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import { newOperationId } from "../worlds/requests.ts";

const envelope = {
  purpose: "personal-records",
  schemaVersion: "erasure.v1",
} as const;

const invalid = () => new InvalidInput({ code: "INVALID_INPUT" });

type ErasureRevision = Extract<
  WorldErasureSuccess,
  { readonly revision: unknown }
>["revision"];

export const inspectWorldErasureRequest = (
  worldRef: WorldRef,
  operationId: string | null = null
) =>
  Schema.decodeEffect(InspectWorldErasure)({
    ...envelope,
    input: { operationId },
    operation: "InspectWorldErasure",
    worldRef,
  }).pipe(Effect.mapError(invalid));

/** Called only by explicit confirmation. Retry retains the resulting request unchanged. */
export const confirmWorldErasureRequest = Effect.fn("web.confirmWorldErasure")(
  function* confirmWorldErasureRequest(
    worldRef: WorldRef,
    expectedErasureRevision: ErasureRevision | null
  ) {
    return yield* Schema.decodeEffect(RequestWorldErasure)({
      ...envelope,
      input: {
        confirmEntireWorld: true,
        expectedErasureRevision,
        policyVersion: "d03-local-erasable-v1",
      },
      operation: "RequestWorldErasure",
      operationId: yield* newOperationId,
      worldRef,
    }).pipe(Effect.mapError(invalid));
  }
);
