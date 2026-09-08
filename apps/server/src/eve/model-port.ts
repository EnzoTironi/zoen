/**
 * Server-owned ModelPort wiring (ZA-19).
 *
 * Live OpenCode Zen HTTP client stays behind EveOpenCodeZen (portable port in
 * ontology). Product composition installs `blockedLayer` until G-PROVIDER
 * qualifies — never activate product Eve/Zen from this PR alone.
 */
import type { EveOpenCodeZenSettings } from "@zoen/ontology/ports/eve/opencode-zen";
import {
  EveOpenCodeZen,
  readOpenCodeZenSettingsFromEnv,
} from "@zoen/ontology/ports/eve/opencode-zen";
import type { Layer } from "effect";

export {
  DEFAULT_OPENCODE_BASE_URL,
  DEFAULT_OPENCODE_MODEL,
  DEFAULT_OPENCODE_USER_AGENT,
  EveOpenCodeZen as EveModelPort,
  openCodeRequestId,
  openCodeSessionId,
  readOpenCodeZenSettingsFromEnv,
  uncertaintyFromModelText,
} from "@zoen/ontology/ports/eve/opencode-zen";
export type {
  EveChatCompletionInput,
  EveChatCompletionResult,
  EveFetch,
  EveOpenCodeZenFailure,
  EveOpenCodeZenSettings,
} from "@zoen/ontology/ports/eve/opencode-zen";

/** Fail-closed ModelPort — G-PROVIDER missing or unqualified. */
export const blockedModelPortLayer: Layer.Layer<EveOpenCodeZen> =
  EveOpenCodeZen.blockedLayer;

/** Live ModelPort only when settings are present AND caller opts in (G-PROVIDER). */
export const liveModelPortLayer = (
  settings: EveOpenCodeZenSettings,
  fetchImpl?: typeof globalThis.fetch
): Layer.Layer<EveOpenCodeZen> => EveOpenCodeZen.liveLayer(settings, fetchImpl);

/**
 * Resolve product ModelPort layer.
 * Without G-PROVIDER / env key → blocked (capability stays disabled).
 */
export const modelPortLayerForProduct = (options: {
  readonly allowLive: boolean;
}): Layer.Layer<EveOpenCodeZen> => {
  if (!options.allowLive) {
    return blockedModelPortLayer;
  }
  const settings = readOpenCodeZenSettingsFromEnv();
  if (settings === null) {
    return blockedModelPortLayer;
  }
  return liveModelPortLayer(settings);
};
