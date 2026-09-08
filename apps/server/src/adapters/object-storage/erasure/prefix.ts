import type { WorldRef } from "@zoen/contracts/worlds/values";

/** Canonical World object namespace. Server-derived only — never accept client prefixes. */
export const worldObjectPrefix = (worldRef: WorldRef): string =>
  `worlds/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/`;

/** Inventory prefixes for erasure of one World (canonical only; no dual-read). */
export const worldObjectInventoryPrefixes = (
  worldRef: WorldRef
): readonly [string] => [worldObjectPrefix(worldRef)];

/** Accept canonical worlds/ keys within the configured realm. */
export const isRealmErasureObjectKey = (key: string, realm: string): boolean =>
  key.startsWith(`worlds/${realm}/`);
