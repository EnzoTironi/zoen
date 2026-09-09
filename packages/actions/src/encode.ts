import type { SemanticRequest } from "@zoen/contracts/worlds/operations";
import type { ActionType } from "@zoen/oms/schemas";

import { encodeErasureRequest } from "./encode-erasure.js";
import { encodeSharingRequest } from "./encode-sharing.js";
import { encodeWorldsRequest } from "./encode-worlds.js";
import { InvalidActionParametersError } from "./invalid-action-parameters-error.js";

/**
 * Map validated OMS Action parameters → tip SemanticRequest for Worlds pack.
 * Dual path: ActionRunner encodes then delegates to SemanticExecutor / ApplicationApi.
 */
export const encodeSemanticRequest = (
  actionType: ActionType,
  parameters: Readonly<Record<string, unknown>>
): SemanticRequest => {
  const { id: actionTypeId, semanticOperation } = actionType;
  const worlds = encodeWorldsRequest(
    actionTypeId,
    semanticOperation,
    parameters
  );
  if (worlds !== null) {
    return worlds;
  }
  const sharing = encodeSharingRequest(
    actionTypeId,
    semanticOperation,
    parameters
  );
  if (sharing !== null) {
    return sharing;
  }
  const erasure = encodeErasureRequest(
    actionTypeId,
    semanticOperation,
    parameters
  );
  if (erasure !== null) {
    return erasure;
  }
  throw new InvalidActionParametersError({
    actionTypeId,
    field: "semanticOperation",
    reason: "kind-mismatch",
  });
};

export const extractWorldScope = (
  parameters: Readonly<Record<string, unknown>>
): {
  readonly realm: "evaluation" | "live" | null;
  readonly worldId: string | null;
} => {
  const { worldRef } = parameters;
  if (
    typeof worldRef === "object" &&
    worldRef !== null &&
    "worldId" in worldRef &&
    "realm" in worldRef
  ) {
    const { realm, worldId } = worldRef;
    if (
      typeof worldId === "string" &&
      (realm === "live" || realm === "evaluation")
    ) {
      return { realm, worldId };
    }
  }
  return { realm: null, worldId: null };
};

export const extractOperationId = (
  parameters: Readonly<Record<string, unknown>>
): string | null => {
  const { operationId } = parameters;
  return typeof operationId === "string" ? operationId : null;
};

export const extractReceiptRef = (result: unknown): string | null => {
  if (
    typeof result !== "object" ||
    result === null ||
    !("receiptRef" in result)
  ) {
    return null;
  }
  const { receiptRef } = result;
  return typeof receiptRef === "string" ? receiptRef : null;
};
