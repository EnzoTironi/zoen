import type { LoadedRegistry } from "../registry.js";
import { loadRegistry } from "../registry.js";
import worldsPackJson from "./worlds.pack.json" with { type: "json" };

export const defaultOmsRegistryDocument = worldsPackJson;

const [worldsPackDocument] = worldsPackJson.packs;
export { worldsPackDocument };

/** Validated default OMS registry (git-versioned seed). */
export const defaultOmsRegistry: LoadedRegistry = loadRegistry(
  defaultOmsRegistryDocument
);
