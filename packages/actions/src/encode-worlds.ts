import { SemanticRequest } from "@zoen/contracts/worlds/operations";
import { Schema } from "effect";

import { optionalPresent, requireString } from "./encode-helpers.js";
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

export const encodeWorldsRequest = (
  actionTypeId: string,
  semanticOperation: string,
  parameters: Readonly<Record<string, unknown>>
): SemanticRequest | null => {
  const purpose = requireString(actionTypeId, "purpose", parameters.purpose);
  const { worldRef } = parameters;

  switch (semanticOperation) {
    case "CreatePersonalWorld": {
      return decodeOrInvalid(actionTypeId, {
        input: {},
        operation: "CreatePersonalWorld",
        operationId: requireString(
          actionTypeId,
          "operationId",
          parameters.operationId
        ),
        purpose,
        schemaVersion: "worlds.v1",
      });
    }
    case "ImportEvidence": {
      const document = requireString(
        actionTypeId,
        "document",
        parameters.document
      );
      const input =
        optionalPresent(parameters, "format") && parameters.format !== undefined
          ? {
              document,
              format: requireString(actionTypeId, "format", parameters.format),
            }
          : { document };
      return decodeOrInvalid(actionTypeId, {
        input,
        operation: "ImportEvidence",
        operationId: requireString(
          actionTypeId,
          "operationId",
          parameters.operationId
        ),
        purpose,
        schemaVersion: "worlds.v1",
        worldRef,
      });
    }
    case "Inspect": {
      return decodeOrInvalid(actionTypeId, {
        input: {
          atFrame: parameters.atFrame ?? null,
          subjectKey: requireString(
            actionTypeId,
            "subjectKey",
            parameters.subjectKey
          ),
        },
        operation: "Inspect",
        purpose,
        schemaVersion: "worlds.v1",
        worldRef,
      });
    }
    case "OpenEvidence": {
      return decodeOrInvalid(actionTypeId, {
        input: {
          evidenceRef: requireString(
            actionTypeId,
            "evidenceRef",
            parameters.evidenceRef
          ),
        },
        operation: "OpenEvidence",
        purpose,
        schemaVersion: "worlds.v1",
        worldRef,
      });
    }
    case "ProposeCorrection": {
      return decodeOrInvalid(actionTypeId, {
        input: {
          consequence: parameters.consequence,
          frameRef: requireString(
            actionTypeId,
            "frameRef",
            parameters.frameRef
          ),
        },
        operation: "ProposeCorrection",
        operationId: requireString(
          actionTypeId,
          "operationId",
          parameters.operationId
        ),
        purpose,
        schemaVersion: "worlds.v1",
        worldRef,
      });
    }
    case "AnswerQuestion": {
      return decodeOrInvalid(actionTypeId, {
        input: {
          answer: requireString(actionTypeId, "answer", parameters.answer),
          consequenceDigest: requireString(
            actionTypeId,
            "consequenceDigest",
            parameters.consequenceDigest
          ),
          questionRef: requireString(
            actionTypeId,
            "questionRef",
            parameters.questionRef
          ),
        },
        operation: "AnswerQuestion",
        operationId: requireString(
          actionTypeId,
          "operationId",
          parameters.operationId
        ),
        purpose,
        schemaVersion: "worlds.v1",
        worldRef,
      });
    }
    case "UndoCorrection": {
      return decodeOrInvalid(actionTypeId, {
        input: {
          correctionRef: requireString(
            actionTypeId,
            "correctionRef",
            parameters.correctionRef
          ),
          frameRef: requireString(
            actionTypeId,
            "frameRef",
            parameters.frameRef
          ),
        },
        operation: "UndoCorrection",
        operationId: requireString(
          actionTypeId,
          "operationId",
          parameters.operationId
        ),
        purpose,
        schemaVersion: "worlds.v1",
        worldRef,
      });
    }
    default: {
      return null;
    }
  }
};
