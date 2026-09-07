import { describe, expect, it } from "@effect/vitest";
import { ConversationId } from "@zoen/contracts/eve/values";
import { Effect, Redacted, Schema } from "effect";

import {
  DEFAULT_OPENCODE_BASE_URL,
  DEFAULT_OPENCODE_MODEL,
  EveOpenCodeZen,
  openCodeSessionId,
  readOpenCodeZenSettingsFromEnv,
  uncertaintyFromModelText,
  type EveFetch,
} from "../../../src/ports/eve/opencode-zen.js";

const conversationId = Schema.decodeSync(ConversationId)(
  "00000000-0000-4000-8000-000000000301"
);

const settings = {
  apiKey: Redacted.make("unit-test-key"),
  baseUrl: "https://example.test/zen/v1",
  model: "big-pickle",
  userAgent: "opencode/1.17.20 zoen-eve",
} as const;

describe("EX42 OpenCode Zen client", () => {
  it("maps session id from conversation UUID without dashes", () => {
    expect(openCodeSessionId(conversationId)).toBe(
      "ses_00000000000040008000000000000301"
    );
  });

  it("maps model text to honest uncertainty", () => {
    expect(uncertaintyFromModelText("")).toBe("Unknown");
    expect(uncertaintyFromModelText("   ")).toBe("Unknown");
    expect(uncertaintyFromModelText("ok")).toBe("Partial");
    expect(uncertaintyFromModelText("eve-ok from big-pickle")).toBe("Known");
  });

  it("reads settings from env without stringifying the key", () => {
    const loaded = readOpenCodeZenSettingsFromEnv({
      ZOEN_OPENCODE_API_KEY: "test-key-not-for-production",
      ZOEN_OPENCODE_BASE_URL: "https://example.test/zen/v1",
      ZOEN_OPENCODE_MODEL: "big-pickle",
    });
    expect(loaded).not.toBeNull();
    expect(loaded?.baseUrl).toBe("https://example.test/zen/v1");
    expect(loaded?.model).toBe("big-pickle");
    expect(Redacted.value(loaded!.apiKey)).toBe("test-key-not-for-production");
    expect(String(loaded!.apiKey)).not.toContain("test-key");
  });

  it("returns null settings when key absent", () => {
    expect(readOpenCodeZenSettingsFromEnv({})).toBeNull();
  });

  it("defaults base URL and model", () => {
    expect(DEFAULT_OPENCODE_BASE_URL).toBe("https://opencode.ai/zen/v1");
    expect(DEFAULT_OPENCODE_MODEL).toBe("big-pickle");
  });

  it.effect("blockedLayer never fabricates a completion", () =>
    Effect.gen(function* blocked() {
      const client = yield* EveOpenCodeZen;
      const exit = yield* Effect.exit(
        client.completeChat({
          conversationId,
          userText: "ping",
        })
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(Effect.provide(EveOpenCodeZen.blockedLayer))
  );

  it.effect("liveLayer sends required OpenCode free-tier headers", () => {
    const seen: { headers?: Headers; body?: unknown; url?: string } = {};
    const fetchImpl: EveFetch = async (url, init) => {
      seen.url = url;
      seen.headers = new Headers(init?.headers);
      seen.body = JSON.parse(String(init?.body));
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "eve-ok" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    };
    return Effect.gen(function* live() {
      const client = yield* EveOpenCodeZen;
      const result = yield* client.completeChat({
        conversationId,
        userText: "reply with eve-ok",
      });
      expect(result.visibleText).toBe("eve-ok");
      expect(result.uncertainty).toBe("Partial");
      expect(seen.url).toBe("https://example.test/zen/v1/chat/completions");
      expect(seen.headers?.get("user-agent")).toBe("opencode/1.17.20 zoen-eve");
      expect(seen.headers?.get("x-opencode-client")).toBe("cli");
      expect(seen.headers?.get("x-opencode-session")).toBe(
        openCodeSessionId(conversationId)
      );
      expect(seen.headers?.get("x-opencode-request")?.startsWith("req_")).toBe(
        true
      );
      expect(seen.headers?.get("authorization")).toBe("Bearer unit-test-key");
      expect((seen.body as { model: string }).model).toBe("big-pickle");
    }).pipe(Effect.provide(EveOpenCodeZen.liveLayer(settings, fetchImpl)));
  });

  it.effect("maps upstream non-OK to Unavailable (never fake success)", () =>
    Effect.gen(function* fail() {
      const client = yield* EveOpenCodeZen;
      const exit = yield* Effect.exit(
        client.completeChat({ conversationId, userText: "x" })
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(
      Effect.provide(
        EveOpenCodeZen.liveLayer(
          settings,
          async () => new Response("nope", { status: 502 })
        )
      )
    )
  );

  it.effect("maps 401/403 to Blocked", () =>
    Effect.gen(function* auth() {
      const client = yield* EveOpenCodeZen;
      const exit = yield* Effect.exit(
        client.completeChat({ conversationId, userText: "x" })
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(
      Effect.provide(
        EveOpenCodeZen.liveLayer(
          settings,
          async () => new Response("denied", { status: 401 })
        )
      )
    )
  );

  it.effect("aborted signal fails without fabricating content", () =>
    Effect.gen(function* aborted() {
      const controller = new AbortController();
      controller.abort();
      const client = yield* EveOpenCodeZen;
      const exit = yield* Effect.exit(
        client.completeChat({
          conversationId,
          signal: controller.signal,
          userText: "x",
        })
      );
      expect(exit._tag).toBe("Failure");
    }).pipe(
      Effect.provide(
        EveOpenCodeZen.liveLayer(settings, async () => {
          throw new Error("fetch should not run");
        })
      )
    )
  );
});
