import type { WorldRef } from "@zoen/contracts/d01/values";

/** Canonical World object namespace. Server-derived only — never accept client prefixes. */
export const worldObjectPrefix = (worldRef: WorldRef): string =>
  `d01/${worldRef.realm}/${worldRef.worldId.toLowerCase()}/`;
