import { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { Schema } from "effect";

import { requireBoolean, requireString } from "./encode-helpers.js";
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

export const encodeErasureRequest = (
  actionTypeId: string,
  semanticOperation: string,
  parameters: Readonly<Record<string, unknown>>
): SemanticRequest | null => {
  const purpose = requireString(actionTypeId, "purpose", parameters.purpose);
  const { worldRef } = parameters;

  switch (semanticOperation) {
    case "RequestWorldErasure": {
      if (
        !requireBoolean(
          actionTypeId,
          "confirmEntireWorld",
          parameters.confirmEntireWorld
        )
      ) {
        throw new InvalidActionParametersError({
          actionTypeId,
          field: "confirmEntireWorld",
          reason: "kind-mismatch",
        });
      }
      return decodeOrInvalid(actionTypeId, {
        input: {
          confirmEntireWorld: true,
          expectedErasureRevision: parameters.expectedErasureRevision ?? null,
          policyVersion: requireString(
            actionTypeId,
            "policyVersion",
            parameters.policyVersion
          ),
        },
        operation: "RequestWorldErasure",
        operationId: requireString(
          actionTypeId,
          "operationId",
          parameters.operationId
        ),
        purpose,
        schemaVersion: "erasure.v1",
        worldRef,
      });
    }
    case "InspectWorldErasure": {
      return decodeOrInvalid(actionTypeId, {
        input: {
          operationId: parameters.operationId ?? null,
        },
        operation: "InspectWorldErasure",
        purpose,
        schemaVersion: "erasure.v1",
        worldRef,
      });
    }
    case "PurgeWorldContent": {
      return decodeOrInvalid(actionTypeId, {
        input: {
          closingOperationId: requireString(
            actionTypeId,
            "closingOperationId",
            parameters.closingOperationId
          ),
          expectedErasureRevision: requireString(
            actionTypeId,
            "expectedErasureRevision",
            parameters.expectedErasureRevision
          ),
        },
        operation: "PurgeWorldContent",
        operationId: requireString(
          actionTypeId,
          "operationId",
          parameters.operationId
        ),
        purpose,
        schemaVersion: "erasure.v1",
        worldRef,
      });
    }
    default: {
      return null;
    }
  }
};
