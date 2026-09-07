import { describe, expect, it } from "@effect/vitest";
import { WorldId } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";

import {
  acceptEveTurnRequest,
  cancelEveTurnRequest,
  recoverEveJournalRequest,
} from "../../../src/features/eve/requests.ts";

const worldRef = {
  realm: "live" as const,
  worldId: Schema.decodeSync(WorldId)("00000000-0000-4000-8000-000000000699"),
};

describe("EX44 Eve web request assembly", () => {
  it.effect("builds product AcceptConversationTurn for OpenCode Zen", () =>
    Effect.gen(function* accept() {
      const request = yield* acceptEveTurnRequest(worldRef, {
        conversationId: "00000000-0000-4000-8000-000000000601",
        ingressId: "00000000-0000-4000-8000-000000000602",
        messageId: "00000000-0000-4000-8000-000000000603",
        relationshipId: "00000000-0000-4000-8000-000000000604",
        turnId: "00000000-0000-4000-8000-000000000605",
        userText: "quanto gastei?",
      });
      expect(request.operation).toBe("AcceptConversationTurn");
      expect(request.input.profileId).toBe("eve-opencode-zen-v1");
      expect(request.input.providerAdmission).toBe("opencode-zen");
      expect(request.worldRef.worldId).toBe(worldRef.worldId);
    })
  );

  it.effect("builds cancel and recover envelopes", () =>
    Effect.gen(function* other() {
      const cancel = yield* cancelEveTurnRequest(
        worldRef,
        "00000000-0000-4000-8000-000000000601",
        "00000000-0000-4000-8000-000000000605"
      );
      expect(cancel.operation).toBe("CancelConversationTurn");
      const recover = yield* recoverEveJournalRequest(
        worldRef,
        "00000000-0000-4000-8000-000000000601"
      );
      expect(recover.operation).toBe("RecoverConversationJournal");
    })
  );
});
