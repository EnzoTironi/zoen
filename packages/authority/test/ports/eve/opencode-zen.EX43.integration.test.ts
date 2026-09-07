import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";
import {
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { Effect, Layer, Schema } from "effect";

import { EveJournal } from "../../../src/ports/eve/journal.js";
import {
  EveOpenCodeZen,
  readOpenCodeZenSettingsFromEnv,
} from "../../../src/ports/eve/opencode-zen.js";
import { runEveTurn } from "../../../src/ports/eve/turn.js";

/** Load `.local/opencode.env` into process.env when present (never log values). */
const loadLocalOpenCodeEnv = (): void => {
  const envPath = path.resolve(process.cwd(), ".local/opencode.env");
  if (!existsSync(envPath)) {
    return;
  }
  const text = readFileSync(envPath, "utf-8");
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value;
  }
};

loadLocalOpenCodeEnv();
const settings = readOpenCodeZenSettingsFromEnv();

describe("EX43 OpenCode Zen live smoke / admission (ZA-17)", () => {
  it.effect(
    "ZA-17-01: missing provider settings stay fail-closed Blocked (not skipped)",
    () => {
      if (settings !== null) {
        // Key present in this environment — live path covered below; still prove
        // blockedLayer refuses fabrication.
        return Effect.gen(function* blocked() {
          const client = yield* EveOpenCodeZen;
          const exit = yield* Effect.exit(
            client.completeChat({
              conversationId: Schema.decodeSync(ConversationId)(randomUUID()),
              userText: "ping",
            })
          );
          expect(exit._tag).toBe("Failure");
        }).pipe(Effect.provide(EveOpenCodeZen.blockedLayer));
      }
      return Effect.gen(function* absent() {
        expect(settings).toBeNull();
        const client = yield* EveOpenCodeZen;
        const exit = yield* Effect.exit(
          client.completeChat({
            conversationId: Schema.decodeSync(ConversationId)(randomUUID()),
            userText: "ping",
          })
        );
        expect(exit._tag).toBe("Failure");
      }).pipe(Effect.provide(EveOpenCodeZen.blockedLayer));
    }
  );

  it.effect(
    "product composition surface stays Blocked even when host key is present",
    () =>
      Effect.gen(function* productBlocked() {
        const exit = yield* Effect.exit(
          runEveTurn({
            conversationId: Schema.decodeSync(ConversationId)(randomUUID()),
            ingressId: Schema.decodeSync(IngressId)(randomUUID()),
            messageId: Schema.decodeSync(MessageId)(randomUUID()),
            profileId: "eve-opencode-zen-v1",
            providerAdmission: "opencode-zen",
            relationshipId: Schema.decodeSync(RelationshipId)(randomUUID()),
            turnId: Schema.decodeSync(TurnId)(randomUUID()),
            userText: "Reply with exactly the token eve-ok and nothing else.",
          })
        );
        expect(exit._tag).toBe("Failure");
      }).pipe(
        Effect.provide(
          // Same pairing product composition installs (ZA-17) — never stubMemory.
          Layer.mergeAll(
            EveJournal.blockedProvidersLayer,
            EveOpenCodeZen.blockedLayer
          )
        )
      )
  );

  it.effect(
    "live provider HTTP boundary only when key present (not product journal)",
    () => {
      if (settings === null) {
        return Effect.void;
      }
      // Isolate OpenCode HTTP at the provider boundary. Do not pair live Zen
      // with EveJournal.stubMemoryLayer — that combination is never product.
      const liveSettings = settings;
      return Effect.gen(function* liveBoundary() {
        const client = yield* EveOpenCodeZen;
        const completion = yield* client.completeChat({
          conversationId: Schema.decodeSync(ConversationId)(randomUUID()),
          userText: "Reply with exactly the token eve-ok and nothing else.",
        });
        expect(completion.visibleText.trim().length).toBeGreaterThan(0);
      }).pipe(Effect.provide(EveOpenCodeZen.liveLayer(liveSettings)));
    }
  );
});
