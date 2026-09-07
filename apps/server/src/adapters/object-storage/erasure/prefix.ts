import type { WorldRef } from "@zoen/contracts/worlds/values";

/** Canonical World object namespace. Server-derived only — never accept client prefixes. */
export const worldObjectPrefix = (worldRef: WorldRef): string =>
  `worlds/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/`;
