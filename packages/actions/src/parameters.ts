import type { ActionParameter, ActionType } from "@zoen/oms/schemas";

import { InvalidActionParametersError } from "./invalid-action-parameters-error.js";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const kindMatches = (
  kind: ActionParameter["kind"],
  value: unknown
): boolean => {
  switch (kind) {
    case "string": {
      return typeof value === "string";
    }
    case "boolean": {
      return typeof value === "boolean";
    }
    case "integer": {
      return typeof value === "number" && Number.isInteger(value);
    }
    case "decimal": {
      return typeof value === "string" || typeof value === "number";
    }
    case "uuid": {
      return typeof value === "string" && uuidPattern.test(value);
    }
    case "instant": {
      return typeof value === "string" && value.length > 0;
    }
    case "json": {
      return value !== undefined;
    }
    case "ref": {
      // Worlds OMS refs are WorldRef objects (realm + worldId). Bare UUID
      // strings are not accepted — SemanticRequest WorldRef is object-only.
      if (!isPlainObject(value)) {
        return false;
      }
      const { realm, worldId } = value;
      return (
        typeof worldId === "string" &&
        uuidPattern.test(worldId) &&
        (realm === "live" || realm === "evaluation")
      );
    }
    default: {
      return false;
    }
  }
};

/**
 * Validate flat Action parameters against the ActionType card.
 * Fail closed on missing required, unexpected keys, null (when not nullable),
 * and kind mismatches.
 */
export const validateActionParameters = (
  actionType: ActionType,
  parameters: Readonly<Record<string, unknown>>
): void => {
  const { id: actionTypeId, parameters: declaredParameters } = actionType;
  const declared = new Map<string, ActionParameter>(
    declaredParameters.map((parameter) => [parameter.name, parameter])
  );
  for (const key of Object.keys(parameters)) {
    if (!declared.has(key)) {
      throw new InvalidActionParametersError({
        actionTypeId,
        field: key,
        reason: "unexpected",
      });
    }
  }
  for (const parameter of declaredParameters) {
    const present = Object.hasOwn(parameters, parameter.name);
    if (!present) {
      if (parameter.optional) {
        continue;
      }
      throw new InvalidActionParametersError({
        actionTypeId,
        field: parameter.name,
        reason: "missing",
      });
    }
    const value = parameters[parameter.name];
    if (value === null) {
      if (!parameter.nullable) {
        throw new InvalidActionParametersError({
          actionTypeId,
          field: parameter.name,
          reason: "null-not-allowed",
        });
      }
      continue;
    }
    if (value === undefined) {
      throw new InvalidActionParametersError({
        actionTypeId,
        field: parameter.name,
        reason: "missing",
      });
    }
    if (
      typeof value === "string" &&
      value.length === 0 &&
      parameter.kind === "string"
    ) {
      throw new InvalidActionParametersError({
        actionTypeId,
        field: parameter.name,
        reason: "empty",
      });
    }
    if (!kindMatches(parameter.kind, value)) {
      throw new InvalidActionParametersError({
        actionTypeId,
        field: parameter.name,
        reason: "kind-mismatch",
      });
    }
  }
};
