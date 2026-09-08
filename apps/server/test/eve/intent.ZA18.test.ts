import { describe, expect, it } from "@effect/vitest";
import {
  ConversationId,
  IngressId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { WorldId } from "@zoen/contracts/worlds/values";
import { Schema } from "effect";

import { eveIngressIntentDigest } from "../../src/eve/intent.ts";

const conversationId = Schema.decodeSync(ConversationId)(
  "11111111-1111-4111-8111-111111111111"
);
const ingressId = Schema.decodeSync(IngressId)(
  "22222222-2222-4222-8222-222222222222"
);
const relationshipId = Schema.decodeSync(RelationshipId)(
  "33333333-3333-4333-8333-333333333333"
);
const turnId = Schema.decodeSync(TurnId)(
  "44444444-4444-4444-8444-444444444444"
);
const worldId = Schema.decodeSync(WorldId)(
  "55555555-5555-4555-8555-555555555555"
);

const base = {
  conversationId,
  ingressId,
  profileId: "eve-local-stub-v1" as const,
  providerAdmission: "stub-local" as const,
  purpose: "personal-records" as const,
  relationshipId,
  turnId,
  userText: "hello",
  worldRef: { realm: "live" as const, worldId },
};

describe("eveIngressIntentDigest ZA-18", () => {
  it("is stable across key insertion order", () => {
    const a = eveIngressIntentDigest(base);
    const b = eveIngressIntentDigest({
      conversationId: base.conversationId,
      ingressId: base.ingressId,
      profileId: base.profileId,
      providerAdmission: base.providerAdmission,
      purpose: base.purpose,
      relationshipId: base.relationshipId,
      turnId: base.turnId,
      userText: base.userText,
      worldRef: base.worldRef,
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("changes when ingress-bound fields change", () => {
    const original = eveIngressIntentDigest(base);
    expect(eveIngressIntentDigest({ ...base, userText: "hello!" })).not.toBe(
      original
    );
    expect(
      eveIngressIntentDigest({
        ...base,
        profileId: "eve-opencode-zen-v1",
        providerAdmission: "opencode-zen",
      })
    ).not.toBe(original);
    expect(
      eveIngressIntentDigest({
        ...base,
        worldRef: null,
      })
    ).not.toBe(original);
  });
});
