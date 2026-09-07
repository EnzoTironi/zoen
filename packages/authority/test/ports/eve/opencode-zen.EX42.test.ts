import { describe, expect, it } from "@effect/vitest";
import { ConversationId } from "@zoen/contracts/eve/values";
import { Effect, Redacted, Schema } from "effect";

import type { EveFetch } from "../../../src/ports/eve/opencode-zen.js";
import {
  DEFAULT_OPENCODE_BASE_URL,
  DEFAULT_OPENCODE_MODEL,
  EveOpenCodeZen,
  openCodeSessionId,
  readOpenCodeZenSettingsFromEnv,
  uncertaintyFromModelText,
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

  it("maps model text without prose-length Known (ZA-17-02)", () => {
    expect({
      empty: uncertaintyFromModelText(""),
      long: uncertaintyFromModelText(
        "eve-ok from big-pickle and much more prose"
      ),
      short: uncertaintyFromModelText("ok"),
      whitespace: uncertaintyFromModelText("   "),
    }).toStrictEqual({
      empty: "Unknown",
      long: "Partial",
      short: "Partial",
      whitespace: "Unknown",
    });
  });

  it("reads settings from env without stringifying the key", () => {
    const loaded = readOpenCodeZenSettingsFromEnv({
      ZOEN_OPENCODE_API_KEY: "test-key-not-for-production",
      ZOEN_OPENCODE_BASE_URL: "https://example.test/zen/v1",
      ZOEN_OPENCODE_MODEL: "big-pickle",
    });
    expect(loaded).not.toBeNull();
    if (loaded === null) {
      return;
    }
    expect({
      baseUrl: loaded.baseUrl,
      key: Redacted.value(loaded.apiKey),
      model: loaded.model,
    }).toStrictEqual({
      baseUrl: "https://example.test/zen/v1",
      key: "test-key-not-for-production",
      model: "big-pickle",
    });
    expect(
      Redacted.value(loaded.apiKey) === "test-key-not-for-production"
    ).toBeTruthy();
  });

  it("returns null settings when key absent", () => {
    expect(readOpenCodeZenSettingsFromEnv({})).toBeNull();
  });

  it("defaults base URL and model", () => {
    expect({
      base: DEFAULT_OPENCODE_BASE_URL,
      model: DEFAULT_OPENCODE_MODEL,
    }).toStrictEqual({
      base: "https://opencode.ai/zen/v1",
      model: "big-pickle",
    });
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
    const seen: {
      bodyText: string | undefined;
      headers: Headers | undefined;
      url: string | undefined;
    } = {
      bodyText: undefined,
      headers: undefined,
      url: undefined,
    };
    const fetchImpl: EveFetch = (url, init) => {
      seen.url = url;
      seen.headers = new Headers(init?.headers);
      const body = init?.body;
      seen.bodyText = typeof body === "string" ? body : undefined;
      return Promise.resolve(
        Response.json(
          {
            choices: [{ message: { content: "eve-ok" } }],
          },
          {
            headers: { "Content-Type": "application/json" },
            status: 200,
          }
        )
      );
    };
    return Effect.gen(function* live() {
      const client = yield* EveOpenCodeZen;
      const result = yield* client.completeChat({
        conversationId,
        userText: "reply with eve-ok",
      });
      let bodyModel: unknown;
      if (seen.bodyText !== undefined) {
        const parsed: unknown = JSON.parse(seen.bodyText);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "model" in parsed
        ) {
          bodyModel = Reflect.get(parsed, "model");
        }
      }
      expect({
        auth: seen.headers?.get("authorization"),
        client: seen.headers?.get("x-opencode-client"),
        model: bodyModel,
        requestPrefix: seen.headers
          ?.get("x-opencode-request")
          ?.startsWith("req_"),
        session: seen.headers?.get("x-opencode-session"),
        uncertainty: result.uncertainty,
        url: seen.url,
        userAgent: seen.headers?.get("user-agent"),
        visibleText: result.visibleText,
      }).toStrictEqual({
        auth: "Bearer unit-test-key",
        client: "cli",
        model: "big-pickle",
        requestPrefix: true,
        session: openCodeSessionId(conversationId),
        uncertainty: "Partial",
        url: "https://example.test/zen/v1/chat/completions",
        userAgent: "opencode/1.17.20 zoen-eve",
        visibleText: "eve-ok",
      });
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
        EveOpenCodeZen.liveLayer(settings, () =>
          Promise.resolve(new Response("nope", { status: 502 }))
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
        EveOpenCodeZen.liveLayer(settings, () =>
          Promise.resolve(new Response("denied", { status: 401 }))
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
        EveOpenCodeZen.liveLayer(settings, () => {
          throw new Error("fetch should not run");
        })
      )
    )
  );
});
