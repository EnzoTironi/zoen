import { InvalidActionParametersError } from "./invalid-action-parameters-error.js";

export const requireString = (
  actionTypeId: string,
  field: string,
  value: unknown
): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidActionParametersError({
      actionTypeId,
      field,
      reason: typeof value === "string" ? "empty" : "kind-mismatch",
    });
  }
  return value;
};

export const requireBoolean = (
  actionTypeId: string,
  field: string,
  value: unknown
): boolean => {
  if (typeof value !== "boolean") {
    throw new InvalidActionParametersError({
      actionTypeId,
      field,
      reason: "kind-mismatch",
    });
  }
  return value;
};

export const optionalPresent = (
  parameters: Readonly<Record<string, unknown>>,
  name: string
): boolean => Object.hasOwn(parameters, name);
