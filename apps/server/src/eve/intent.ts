import { createHash } from "node:crypto";

import type {
  ConversationId,
  EveProfileId,
  EveProviderAdmission,
  IngressId,
  RelationshipId,
  TurnId,
} from "@zoen/contracts/eve/values";
import { Digest as DigestSchema } from "@zoen/contracts/worlds/values";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Schema } from "effect";

/**
 * Exact ingress intent binding for ZA-18 replay/Conflict.
 * Same scope+key+intent replays; changed ingress text conflicts before disclosure.
 */
export interface EveIngressIntent {
  readonly conversationId: ConversationId;
  readonly ingressId: IngressId;
  readonly profileId: EveProfileId;
  readonly providerAdmission: EveProviderAdmission;
  readonly purpose: "personal-records";
  readonly relationshipId: RelationshipId;
  readonly turnId: TurnId;
  readonly userText: string;
  readonly worldRef: WorldRef | null;
}

const sortedJson = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(sortedJson).join(",")}]`;
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).toSorted();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${sortedJson(record[key])}`)
    .join(",")}}`;
};

export const eveIngressIntentDigest = (
  intent: EveIngressIntent
): typeof DigestSchema.Type =>
  Schema.decodeSync(DigestSchema)(
    createHash("sha256")
      .update(
        `zoen:eve:ingress-intent:v1\n${sortedJson({
          conversationId: intent.conversationId,
          ingressId: intent.ingressId,
          profileId: intent.profileId,
          providerAdmission: intent.providerAdmission,
          purpose: intent.purpose,
          relationshipId: intent.relationshipId,
          turnId: intent.turnId,
          userText: intent.userText,
          worldRef: intent.worldRef,
        })}`
      )
      .digest("hex")
  );
