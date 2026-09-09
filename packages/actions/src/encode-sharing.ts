import { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { Schema } from "effect";

import { requireString } from "./encode-helpers.js";
import { InvalidActionParametersError } from "./invalid-action-parameters-error.js";

const decodeOrInvalid = (
  actionTypeId: string,
  candidate: unknown
): SemanticRequest => {
  try {
    return Schema.decodeUnknownSync(SemanticRequest)(candidate);
  } catch {
    throw new InvalidActionParametersError({
      actionTypeId,
      field: "parameters",
      reason: "kind-mismatch",
    });
  }
};

export const encodeSharingRequest = (
  actionTypeId: string,
  semanticOperation: string,
  parameters: Readonly<Record<string, unknown>>
): SemanticRequest | null => {
  const purpose = requireString(actionTypeId, "purpose", parameters.purpose);
  const { worldRef } = parameters;

  switch (semanticOperation) {
    case "InspectWorldAccess": {
      return decodeOrInvalid(actionTypeId, {
        input: {
          principalRef: parameters.principalRef ?? null,
        },
        operation: "InspectWorldAccess",
        purpose,
        schemaVersion: "sharing.v1",
        worldRef,
      });
    }
    case "GrantWorldReadAccess": {
      return decodeOrInvalid(actionTypeId, {
        input: {
          expectedRevision: parameters.expectedRevision ?? null,
          principalRef: requireString(
            actionTypeId,
            "principalRef",
            parameters.principalRef
          ),
        },
        operation: "GrantWorldReadAccess",
        operationId: requireString(
          actionTypeId,
          "operationId",
          parameters.operationId
        ),
        purpose,
        schemaVersion: "sharing.v1",
        worldRef,
      });
    }
    case "RevokeWorldReadAccess": {
      return decodeOrInvalid(actionTypeId, {
        input: {
          expectedRevision: requireString(
            actionTypeId,
            "expectedRevision",
            parameters.expectedRevision
          ),
          principalRef: requireString(
            actionTypeId,
            "principalRef",
            parameters.principalRef
          ),
        },
        operation: "RevokeWorldReadAccess",
        operationId: requireString(
          actionTypeId,
          "operationId",
          parameters.operationId
        ),
        purpose,
        schemaVersion: "sharing.v1",
        worldRef,
      });
    }
    default: {
      return null;
    }
  }
};
