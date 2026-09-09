import { worldsSemanticOperations } from "@zoen/oms/packs/worlds";

/** Worlds pack #1 semantic operations registered as OMS Action Types. */
export const worldsPackOperations = worldsSemanticOperations;

export type WorldsPackOperation = (typeof worldsPackOperations)[number];

const worldsPackOperationSet = new Set<string>(worldsPackOperations);

/** True when the tip SemanticRequest.operation is a Worlds pack Action Type. */
export const isWorldsPackOperation = (
  operation: string
): operation is WorldsPackOperation => worldsPackOperationSet.has(operation);

/** OMS Action Type id for a Worlds pack semantic operation. */
export const worldsActionTypeId = (
  operation: WorldsPackOperation
): `worlds.${WorldsPackOperation}` => `worlds.${operation}`;
