import { describe, expect, it } from "@effect/vitest";
import { EveGroundedBasis } from "@zoen/contracts/eve/tools";
import {
  ClaimRef,
  EvidenceRef,
  SubjectKey,
  WorldId,
} from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";

import {
  parseEveDomainToolCall,
  rejectDangerousToolPayload,
  settleUncertaintyForGroundedTurn,
} from "../../src/semantic/grounding.js";

const worldRef = {
  realm: "live" as const,
  worldId: Schema.decodeSync(WorldId)("00000000-0000-4000-8000-000000000701"),
};
const subjectKey = Schema.decodeSync(SubjectKey)("obligation-1");
const claimA = Schema.decodeSync(ClaimRef)(
  "00000000-0000-4000-8000-000000000702"
);
const claimB = Schema.decodeSync(ClaimRef)(
  "00000000-0000-4000-8000-000000000703"
);
const evidenceA = Schema.decodeSync(EvidenceRef)(
  "00000000-0000-4000-8000-000000000704"
);
const evidenceB = Schema.decodeSync(EvidenceRef)(
  "00000000-0000-4000-8000-000000000705"
);

const contestedBasis = Schema.decodeSync(EveGroundedBasis)({
  contested: true,
  facts: [
    {
      claimRef: claimA,
      evidenceRef: evidenceA,
      predicate: "obligation.amount",
      subjectKey,
    },
    {
      claimRef: claimB,
      evidenceRef: evidenceB,
      predicate: "obligation.amount",
      subjectKey,
    },
  ],
  references: [evidenceA, evidenceB],
  schemaVersion: "eve.v1",
  subjectKey,
  uncertainty: "Partial",
  worldRef,
});

describe("ZA-19 semantic grounding", () => {
  it.effect(
    "contested authorized basis settles Partial — never Known from prose",
    () =>
      Effect.sync(() => {
        const settle = settleUncertaintyForGroundedTurn({
          basis: contestedBasis,
          citationsAuthorized: true,
          generatedText: "long model prose that must not force Known",
        });
        expect({
          contested: contestedBasis.contested,
          factCount: contestedBasis.facts.length,
          referenceCount: contestedBasis.references.length,
          settle,
          uncertainty: contestedBasis.uncertainty,
        }).toStrictEqual({
          contested: true,
          factCount: 2,
          referenceCount: 2,
          settle: "Partial",
          uncertainty: "Partial",
        });
      })
  );

  it.effect("ZA-19-02 forged tool JSON / injection denied", () =>
    Effect.gen(function* forged() {
      const badName = yield* Effect.exit(
        parseEveDomainToolCall({
          arguments: { subjectKey: "obligation-1" },
          name: "run_sql",
        })
      );
      const excess = yield* Effect.exit(
        parseEveDomainToolCall({
          arguments: { shell: "rm -rf /", subjectKey: "obligation-1" },
          name: "inspect_subject",
        })
      );
      const sql = yield* Effect.exit(
        rejectDangerousToolPayload({
          arguments: { subjectKey: "x" },
          name: "inspect_subject",
          note: "SELECT * FROM authority.claims",
        })
      );
      const creds = yield* Effect.exit(
        rejectDangerousToolPayload("Authorization: Bearer sk-secret")
      );
      const ok = yield* parseEveDomainToolCall({
        arguments: { subjectKey: "obligation-1" },
        name: "inspect_subject",
      });
      expect({
        badName: badName._tag,
        creds: creds._tag,
        excess: excess._tag,
        ok: ok.name,
        sql: sql._tag,
      }).toStrictEqual({
        badName: "Failure",
        creds: "Failure",
        excess: "Failure",
        ok: "inspect_subject",
        sql: "Failure",
      });
    })
  );
});
