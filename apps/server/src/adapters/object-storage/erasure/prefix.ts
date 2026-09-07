import type { WorldRef } from "@zoen/contracts/worlds/values";

/** Canonical World object namespace. Server-derived only — never accept client prefixes. */
export const worldObjectPrefix = (worldRef: WorldRef): string =>
  `worlds/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/`;

/**
 * Pre-launch residual namespace from the d01→worlds rename.
 * Inventory and purge scrub this until empty; new writes use worlds/ only.
 */
export const legacyWorldObjectPrefix = (worldRef: WorldRef): string =>
  `d01/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/`;

/** Canonical + residual prefixes for erasure inventory of one World. */
export const worldObjectInventoryPrefixes = (
  worldRef: WorldRef
): readonly [string, string] => [
  worldObjectPrefix(worldRef),
  legacyWorldObjectPrefix(worldRef),
];

/** Accept canonical worlds/ or residual d01/ keys within the configured realm. */
export const isRealmErasureObjectKey = (key: string, realm: string): boolean =>
  key.startsWith(`worlds/${realm}/`) || key.startsWith(`d01/${realm}/`);
