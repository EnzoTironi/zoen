import {
  Blocked,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import type { ConversationId } from "@zoen/contracts/eve/values";
import type { UncertaintyKind } from "@zoen/contracts/eve/values";
import { Context, Effect, Layer, Redacted } from "effect";
import type { Effect as EffectType } from "effect";
import { randomBytes } from "node:crypto";

/**
 * OpenCode Zen free — OpenAI-compatible chat client (ZN-0063 / D05 product path).
 *
 * Free-tier models require OpenCode CLI identity headers; plain curl is rejected.
 * Paid models do not require User-Agent spoofing (observed; see verification doc).
 * API key must come from env / Fly secret only — never journal, fixtures, or logs.
 */

export const DEFAULT_OPENCODE_BASE_URL = "https://opencode.ai/zen/v1";
export const DEFAULT_OPENCODE_MODEL = "big-pickle";
export const DEFAULT_OPENCODE_USER_AGENT = "opencode/1.17.20 zoen-eve";

export interface EveOpenCodeZenSettings {
  readonly apiKey: Redacted.Redacted;
  readonly baseUrl: string;
  readonly model: string;
  readonly userAgent: string;
}

export interface EveChatCompletionInput {
  readonly conversationId: ConversationId;
  readonly signal?: AbortSignal;
  readonly systemText?: string;
  readonly userText: string;
}

export interface EveChatCompletionResult {
  readonly model: string;
  readonly uncertainty: UncertaintyKind;
  readonly visibleText: string;
}

export type EveOpenCodeZenFailure = Blocked | Unavailable;

export type EveFetch = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

const unavailable = () => new Unavailable({ code: "UNAVAILABLE" });
const blocked = () => new Blocked({ code: "PROFILE_BLOCKED" });

/** Stable OpenCode session id derived from conversation UUID (no dashes). */
export const openCodeSessionId = (conversationId: ConversationId): string =>
  `ses_${conversationId.replaceAll("-", "")}`;

export const openCodeRequestId = (): string =>
  `req_${randomBytes(16).toString("hex")}`;

const truncateVisible = (text: string): string =>
  text.length <= 16_384 ? text : text.slice(0, 16_384);

/**
 * Map a successful model payload to honest uncertainty.
 * Empty / whitespace-only content is Unknown — never fake Known.
 */
export const uncertaintyFromModelText = (
  text: string
): UncertaintyKind => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return "Unknown";
  }
  if (trimmed.length < 8) {
    return "Partial";
  }
  return "Known";
};

const parseChatContent = (body: unknown): string | null => {
  if (body === null || typeof body !== "object") {
    return null;
  }
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }
  const first = choices[0];
  if (first === null || typeof first !== "object") {
    return null;
  }
  const message = (first as { message?: unknown }).message;
  if (message === null || typeof message !== "object") {
    return null;
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content !== "string") {
    return null;
  }
  return content;
};

export class EveOpenCodeZen extends Context.Service<
  EveOpenCodeZen,
  {
    readonly completeChat: (
      input: EveChatCompletionInput
    ) => EffectType.Effect<EveChatCompletionResult, EveOpenCodeZenFailure>;
  }
>()("zoen/authority/ports/eve/EveOpenCodeZen") {
  /** Fail-closed when key/profile is absent — never mock-healthy success. */
  static readonly blockedLayer = Layer.succeed(
    EveOpenCodeZen,
    EveOpenCodeZen.of({
      completeChat: () => Effect.fail(blocked()),
    })
  );

  static readonly liveLayer = (
    settings: EveOpenCodeZenSettings,
    fetchImpl: EveFetch = globalThis.fetch.bind(globalThis)
  ) =>
    Layer.succeed(
      EveOpenCodeZen,
      EveOpenCodeZen.of({
        completeChat: (input) =>
          Effect.tryPromise({
            try: async () => {
              if (input.signal?.aborted) {
                throw new DOMException("Aborted", "AbortError");
              }
              const base = settings.baseUrl.endsWith("/")
                ? settings.baseUrl.slice(0, -1)
                : settings.baseUrl;
              const url = `${base}/chat/completions`;
              const init: RequestInit = {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${Redacted.value(settings.apiKey)}`,
                  "Content-Type": "application/json",
                  "User-Agent": settings.userAgent,
                  "x-opencode-client": "cli",
                  "x-opencode-session": openCodeSessionId(input.conversationId),
                  "x-opencode-request": openCodeRequestId(),
                },
                body: JSON.stringify({
                  model: settings.model,
                  messages: [
                    ...(input.systemText === undefined
                      ? []
                      : [{ role: "system", content: input.systemText }]),
                    { role: "user", content: input.userText },
                  ],
                }),
              };
              if (input.signal !== undefined) {
                init.signal = input.signal;
              }
              const response = await fetchImpl(url, init);
              if (response.status === 401 || response.status === 403) {
                throw Object.assign(new Error("auth"), { kind: "blocked" });
              }
              if (!response.ok) {
                throw Object.assign(new Error("upstream"), {
                  kind: "unavailable",
                  status: response.status,
                });
              }
              const json: unknown = await response.json();
              const content = parseChatContent(json);
              if (content === null) {
                throw Object.assign(new Error("empty"), {
                  kind: "unavailable",
                });
              }
              const visibleText = truncateVisible(content);
              return {
                model: settings.model,
                uncertainty: uncertaintyFromModelText(visibleText),
                visibleText,
              } satisfies EveChatCompletionResult;
            },
            catch: (cause) => {
              if (
                cause instanceof Error &&
                (cause.name === "AbortError" || cause.message === "Aborted")
              ) {
                return unavailable();
              }
              if (
                typeof cause === "object" &&
                cause !== null &&
                "kind" in cause &&
                (cause as { kind: string }).kind === "blocked"
              ) {
                return blocked();
              }
              return unavailable();
            },
          }),
      })
    );
}

/** Read OpenCode Zen settings from process env (never log the key). */
export const readOpenCodeZenSettingsFromEnv = (
  env: NodeJS.ProcessEnv = process.env
): EveOpenCodeZenSettings | null => {
  const apiKey =
    env.ZOEN_OPENCODE_API_KEY?.trim() || env.OPENCODE_API_KEY?.trim();
  if (apiKey === undefined || apiKey.length === 0) {
    return null;
  }
  return {
    apiKey: Redacted.make(apiKey),
    baseUrl:
      env.ZOEN_OPENCODE_BASE_URL?.trim() || DEFAULT_OPENCODE_BASE_URL,
    model: env.ZOEN_OPENCODE_MODEL?.trim() || DEFAULT_OPENCODE_MODEL,
    userAgent: DEFAULT_OPENCODE_USER_AGENT,
  };
};
