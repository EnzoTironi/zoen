import { describe, expect, it } from "@effect/vitest";
import { Result, Schema } from "effect";

import {
  AcceptConversationTurn,
  CancelConversationTurn,
  RecoverConversationJournal,
  SettleConversationMessage,
} from "../../src/eve/operations.js";
import {
  EveAuthorityCredentialForbidden,
  EveJournalSnapshot,
  EveLocalStubProfileId,
  EveOpenCodeZenProfileId,
  EveProfileId,
  EveProviderAdmission,
  EveSchemaVersion,
  EveWebSpeechCapabilities,
} from "../../src/eve/values.js";

const conversationId = "00000000-0000-4000-8000-000000000101";
const relationshipId = "00000000-0000-4000-8000-000000000102";
const ingressId = "00000000-0000-4000-8000-000000000103";
const turnId = "00000000-0000-4000-8000-000000000104";
const messageId = "00000000-0000-4000-8000-000000000105";
const evidenceRef = "00000000-0000-4000-8000-000000000106";

describe("EX40 eve schemas", () => {
  it("freezes stub + OpenCode Zen profiles and eve.v1 wire tag", () => {
    expect({
      foreignProfile: Result.isFailure(
        Schema.decodeUnknownResult(EveLocalStubProfileId)(
          "d01-local-retained-v1"
        )
      ),
      foreignSchema: Result.isFailure(
        Schema.decodeUnknownResult(EveSchemaVersion)("hosted.v1")
      ),
      profileId: Schema.decodeSync(EveProfileId)("eve-opencode-zen-v1"),
      schema: Schema.decodeSync(EveSchemaVersion)("eve.v1"),
      stub: Schema.decodeSync(EveLocalStubProfileId)("eve-local-stub-v1"),
      zen: Schema.decodeSync(EveOpenCodeZenProfileId)("eve-opencode-zen-v1"),
    }).toStrictEqual({
      foreignProfile: true,
      foreignSchema: true,
      profileId: "eve-opencode-zen-v1",
      schema: "eve.v1",
      stub: "eve-local-stub-v1",
      zen: "eve-opencode-zen-v1",
    });
  });

  it("encodes AcceptConversationTurn under opencode-zen admission", () => {
    const request = Schema.decodeSync(AcceptConversationTurn)({
      input: {
        conversationId,
        ingressId,
        profileId: "eve-opencode-zen-v1",
        providerAdmission: "opencode-zen",
        relationshipId,
        userText: "quanto gastei?",
      },
      operation: "AcceptConversationTurn",
      purpose: "personal-records",
      schemaVersion: "eve.v1",
    });
    expect(request.operation).toBe("AcceptConversationTurn");
    expect(request.input.providerAdmission).toBe("opencode-zen");
  });

  it("still encodes stub-local Accept for offline unit proofs", () => {
    const request = Schema.decodeSync(AcceptConversationTurn)({
      input: {
        conversationId,
        ingressId,
        profileId: "eve-local-stub-v1",
        providerAdmission: "stub-local",
        relationshipId,
        userText: "offline",
      },
      operation: "AcceptConversationTurn",
      purpose: "personal-records",
      schemaVersion: "eve.v1",
    });
    expect(request.input.providerAdmission).toBe("stub-local");
  });

  it("encodes AcceptConversationTurn under web-speech voice admission", () => {
    const request = Schema.decodeSync(AcceptConversationTurn)({
      input: {
        conversationId,
        ingressId,
        profileId: "eve-web-speech-v1",
        providerAdmission: "web-speech",
        relationshipId,
        userText: "quanto gastei?",
      },
      operation: "AcceptConversationTurn",
      purpose: "personal-records",
      schemaVersion: "eve.v1",
    });
    expect(request.input.providerAdmission).toBe("web-speech");
    expect(Schema.decodeSync(EveProviderAdmission)("web-speech")).toBe(
      "web-speech"
    );
    expect(
      Schema.decodeSync(EveWebSpeechCapabilities)({
        admission: "web-speech",
        profileId: "eve-web-speech-v1",
        recognitionAvailable: true,
        synthesisAvailable: true,
      }).recognitionAvailable
    ).toBeTruthy();
  });

  it("admits cancel and recover operations", () => {
    expect(
      Schema.decodeSync(CancelConversationTurn)({
        input: { conversationId, turnId },
        operation: "CancelConversationTurn",
        purpose: "personal-records",
        schemaVersion: "eve.v1",
      }).operation
    ).toBe("CancelConversationTurn");
    expect(
      Schema.decodeSync(RecoverConversationJournal)({
        input: { conversationId },
        operation: "RecoverConversationJournal",
        purpose: "personal-records",
        schemaVersion: "eve.v1",
      }).operation
    ).toBe("RecoverConversationJournal");
  });

  it("settles visible text with explicit uncertainty", () => {
    const settled = Schema.decodeSync(SettleConversationMessage)({
      input: {
        conversationId,
        evidenceLinks: [{ claimRef: null, evidenceRef }],
        messageId,
        turnId,
        uncertainty: "Partial",
        visibleText: "Há evidência parcial; valor exato ainda Unknown.",
      },
      operation: "SettleConversationMessage",
      purpose: "personal-records",
      schemaVersion: "eve.v1",
    });
    expect(settled.input.uncertainty).toBe("Partial");
    expect(settled.input.evidenceLinks).toHaveLength(1);
  });

  it("admits blocked provider literals and forbids authority credentials", () => {
    expect(Schema.decodeSync(EveProviderAdmission)("opencode-zen")).toBe(
      "opencode-zen"
    );
    expect(Schema.decodeSync(EveProviderAdmission)("real-model-blocked")).toBe(
      "real-model-blocked"
    );
    expect(Schema.decodeSync(EveProviderAdmission)("voice-blocked")).toBe(
      "voice-blocked"
    );
    expect(
      Schema.decodeSync(EveAuthorityCredentialForbidden)(false)
    ).toBeFalsy();
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(EveAuthorityCredentialForbidden)(true)
      )
    ).toBeTruthy();
  });

  it("round-trips a recoverable journal snapshot without credentials", () => {
    const snapshot = Schema.decodeSync(EveJournalSnapshot)({
      authorityCredentialPresent: false,
      conversation: {
        conversationId,
        profileId: "eve-opencode-zen-v1",
        relationshipId,
        revision: "1",
        schemaVersion: "eve.v1",
        worldRef: null,
      },
      messages: [],
      providerAdmission: "opencode-zen",
      turns: [
        {
          conversationId,
          ingressId,
          phase: "Accepted",
          turnId,
          version: "1",
        },
      ],
    });
    expect(snapshot.authorityCredentialPresent).toBeFalsy();
    expect(snapshot.turns).toHaveLength(1);
    expect(snapshot.providerAdmission).toBe("opencode-zen");
  });

  it("rejects foreign profile ids and healthy-looking provider literals", () => {
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(AcceptConversationTurn)({
          input: {
            conversationId,
            ingressId,
            profileId: "d04-hosted-retained-v1",
            providerAdmission: "stub-local",
            relationshipId,
            userText: "x",
          },
          operation: "AcceptConversationTurn",
          purpose: "personal-records",
          schemaVersion: "eve.v1",
        })
      )
    ).toBeTruthy();
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(EveProviderAdmission)("healthy")
      )
    ).toBeTruthy();
  });
});
