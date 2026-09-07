import { describe, expect, it } from "@effect/vitest";
import {
  ConversationId,
  IngressId,
  MessageId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { Effect, Layer, Schema } from "effect";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { EveJournal } from "../../../src/ports/eve/journal.js";
import {
  EveOpenCodeZen,
  readOpenCodeZenSettingsFromEnv,
} from "../../../src/ports/eve/opencode-zen.js";
import { runEveTurn } from "../../../src/ports/eve/turn.js";

/** Load `.local/opencode.env` into process.env when present (never log values). */
const loadLocalOpenCodeEnv = (): void => {
  const path = resolve(process.cwd(), ".local/opencode.env");
  if (!existsSync(path)) {
    return;
  }
  const text = readFileSync(path, "utf8");
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
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
};

loadLocalOpenCodeEnv();
const settings = readOpenCodeZenSettingsFromEnv();
const describeLive = settings === null ? describe.skip : describe;

describeLive("EX43 OpenCode Zen live smoke (gated)", () => {
  it.effect(
    "accept → live model → settle returns non-empty model text",
    () => {
      const conversationId = Schema.decodeSync(ConversationId)(randomUUID());
      const relationshipId = Schema.decodeSync(RelationshipId)(randomUUID());
      const ingressId = Schema.decodeSync(IngressId)(randomUUID());
      const turnId = Schema.decodeSync(TurnId)(randomUUID());
      const messageId = Schema.decodeSync(MessageId)(randomUUID());
      const layer = Layer.mergeAll(
        EveJournal.stubMemoryLayer,
        EveOpenCodeZen.liveLayer(settings!)
      );
      return Effect.gen(function* live() {
        const result = yield* runEveTurn({
          conversationId,
          ingressId,
          messageId,
          profileId: "eve-opencode-zen-v1",
          providerAdmission: "opencode-zen",
          relationshipId,
          turnId,
          userText:
            "Reply with exactly the token eve-ok and nothing else.",
        });
        expect(result.message.state).toBe("Visible");
        expect(result.message.visibleText.trim().length).toBeGreaterThan(0);
        expect(["Known", "Partial", "Unknown"]).toContain(
          result.message.uncertainty
        );

        const journal = yield* EveJournal;
        const snapshot = yield* journal.recover(conversationId);
        expect(snapshot.authorityCredentialPresent).toBeFalsy();
        const wire = JSON.stringify(snapshot);
        expect(wire.includes("sk-")).toBeFalsy();
        const keyValue = process.env.ZOEN_OPENCODE_API_KEY;
        if (keyValue !== undefined && keyValue.length > 0) {
          expect(wire.includes(keyValue)).toBeFalsy();
        }
      }).pipe(Effect.provide(layer));
    }
  );
});
