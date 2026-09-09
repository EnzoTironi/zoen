import type { SemanticRequest } from "@zoen/contracts/worlds/operations";

import type { RunActionInput } from "./runner.js";
import { isWorldsPackOperation, worldsActionTypeId } from "./worlds-ops.js";

/**
 * Flatten tip SemanticRequest → OMS ActionRunner input for Worlds pack #1.
 * Returns null for subject-identity (and any non-pack) ops — escape hatch.
 */
export const tryMapWorldsAction = (
  request: SemanticRequest
): RunActionInput | null => {
  if (!isWorldsPackOperation(request.operation)) {
    return null;
  }
  const actionTypeId = worldsActionTypeId(request.operation);

  switch (request.operation) {
    case "CreatePersonalWorld": {
      return {
        actionTypeId,
        parameters: {
          operationId: request.operationId,
          purpose: request.purpose,
        },
      };
    }
    case "ImportEvidence": {
      const parameters: Record<string, unknown> = {
        document: request.input.document,
        operationId: request.operationId,
        purpose: request.purpose,
        worldRef: request.worldRef,
      };
      if ("format" in request.input) {
        parameters.format = request.input.format;
      }
      return { actionTypeId, parameters };
    }
    case "Inspect": {
      return {
        actionTypeId,
        parameters: {
          atFrame: request.input.atFrame,
          purpose: request.purpose,
          subjectKey: request.input.subjectKey,
          worldRef: request.worldRef,
        },
      };
    }
    case "OpenEvidence": {
      return {
        actionTypeId,
        parameters: {
          evidenceRef: request.input.evidenceRef,
          purpose: request.purpose,
          worldRef: request.worldRef,
        },
      };
    }
    case "ProposeCorrection": {
      return {
        actionTypeId,
        parameters: {
          consequence: request.input.consequence,
          frameRef: request.input.frameRef,
          operationId: request.operationId,
          purpose: request.purpose,
          worldRef: request.worldRef,
        },
      };
    }
    case "AnswerQuestion": {
      return {
        actionTypeId,
        parameters: {
          answer: request.input.answer,
          consequenceDigest: request.input.consequenceDigest,
          operationId: request.operationId,
          purpose: request.purpose,
          questionRef: request.input.questionRef,
          worldRef: request.worldRef,
        },
      };
    }
    case "UndoCorrection": {
      return {
        actionTypeId,
        parameters: {
          correctionRef: request.input.correctionRef,
          frameRef: request.input.frameRef,
          operationId: request.operationId,
          purpose: request.purpose,
          worldRef: request.worldRef,
        },
      };
    }
    case "InspectWorldAccess": {
      return {
        actionTypeId,
        parameters: {
          principalRef: request.input.principalRef,
          purpose: request.purpose,
          worldRef: request.worldRef,
        },
      };
    }
    case "GrantWorldReadAccess": {
      return {
        actionTypeId,
        parameters: {
          expectedRevision: request.input.expectedRevision,
          operationId: request.operationId,
          principalRef: request.input.principalRef,
          purpose: request.purpose,
          worldRef: request.worldRef,
        },
      };
    }
    case "RevokeWorldReadAccess": {
      return {
        actionTypeId,
        parameters: {
          expectedRevision: request.input.expectedRevision,
          operationId: request.operationId,
          principalRef: request.input.principalRef,
          purpose: request.purpose,
          worldRef: request.worldRef,
        },
      };
    }
    case "RequestWorldErasure": {
      return {
        actionTypeId,
        parameters: {
          confirmEntireWorld: request.input.confirmEntireWorld,
          expectedErasureRevision: request.input.expectedErasureRevision,
          operationId: request.operationId,
          policyVersion: request.input.policyVersion,
          purpose: request.purpose,
          worldRef: request.worldRef,
        },
      };
    }
    case "InspectWorldErasure": {
      return {
        actionTypeId,
        parameters: {
          operationId: request.input.operationId,
          purpose: request.purpose,
          worldRef: request.worldRef,
        },
      };
    }
    case "PurgeWorldContent": {
      return {
        actionTypeId,
        parameters: {
          closingOperationId: request.input.closingOperationId,
          expectedErasureRevision: request.input.expectedErasureRevision,
          operationId: request.operationId,
          purpose: request.purpose,
          worldRef: request.worldRef,
        },
      };
    }
    default: {
      // Subject-identity and future non-pack ops already returned null above.
      return null;
    }
  }
};
