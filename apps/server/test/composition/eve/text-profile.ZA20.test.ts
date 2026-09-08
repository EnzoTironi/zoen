import { describe, expect, it } from "@effect/vitest";
import { ConversationId } from "@zoen/contracts/eve/values";
import {
  currentProductEveAdmissionInput,
  isProductEveAdmitted,
} from "@zoen/ontology/ports/eve/admission";
import { EveOpenCodeZen } from "@zoen/ontology/ports/eve/opencode-zen";
import {
  acceptedGroundedTextProfile,
  isTextProfileAccepted,
} from "@zoen/ontology/ports/eve/text-profile";
import { Effect, Schema } from "effect";

import { makeProductEveSurface } from "../../../src/composition.ts";

const conversationId = Schema.decodeSync(ConversationId)(
  "00000000-0000-4000-8000-000000000901"
);

describe("ZA-20 product Eve text-profile composition", () => {
  it("ZA-20 records narrow text profile acceptance without admitting product alone", () => {
    expect(isTextProfileAccepted(acceptedGroundedTextProfile())).toBeTruthy();
    expect(
      isProductEveAdmitted(
        currentProductEveAdmissionInput(true, {
          durableJournalQualified: true,
          evidenceGroundingQualified: false,
          textProfileAccepted: true,
        })
      )
    ).toBeFalsy();
  });

  it.effect(
    "ZA-20-02: text profile accepted without journal/grounding keeps Zen blocked",
    () =>
      Effect.gen(function* profileWithoutGates() {
        const surface = yield* makeProductEveSurface(true, {
          textProfileAccepted: true,
        });
        yield* Effect.gen(function* assertBlocked() {
          const zen = yield* EveOpenCodeZen;
          const zenExit = yield* Effect.exit(
            zen.completeChat({
              conversationId,
              userText: "ping",
            })
          );
          expect(zenExit._tag).toBe("Failure");
        }).pipe(Effect.provide(surface));
      })
  );

  it.effect(
    "ZA-20-02: explicit textProfileAccepted false keeps surface blocked",
    () =>
      Effect.gen(function* profileRejected() {
        const surface = yield* makeProductEveSurface(true, {
          evidenceGroundingQualified: true,
          textProfileAccepted: false,
        });
        yield* Effect.gen(function* assertBlocked() {
          const zen = yield* EveOpenCodeZen;
          const zenExit = yield* Effect.exit(
            zen.completeChat({
              conversationId,
              userText: "ping",
            })
          );
          expect(zenExit._tag).toBe("Failure");
        }).pipe(Effect.provide(surface));
      })
  );
});
