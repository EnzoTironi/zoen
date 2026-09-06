import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { layer as s3EvidenceLayer } from "../../../../apps/server/src/adapters/object-storage/d01/s3.js";
import { withStorage } from "../../../../apps/server/test/adapters/object-storage/d01/fixture.js";
import { withD01IdentityDatabase } from "../../../../apps/server/test/identity/d01/database.js";
import {
  createAccount,
  postAuth,
} from "../../../../apps/server/test/identity/d01/http.js";
import { SemanticExecutor } from "../../../../packages/authority/src/semantic/executor.js";
import { canonicalJson } from "../../../../packages/authority/src/values/canonical.js";
import { WorldCreated } from "../../../../packages/contracts/src/d01/operations.js";
import {
  IdentityProposed,
  IdentityResolved,
  IdentityRecoveryInspected,
  SubjectIdentityInspected,
} from "../../../../packages/contracts/src/subject-identity/operations.js";
import { configuration } from "../../d01/commit/fixture.js";

const bytes = (value: unknown) =>
  canonicalJson(value).pipe(
    Effect.map((json) => new TextEncoder().encode(json))
  );

const envelope = {
  purpose: "personal-records" as const,
  schemaVersion: "subject-identity.v1" as const,
};
const d01 = {
  purpose: "personal-records" as const,
  schemaVersion: "d01.v1" as const,
};
const interval = {
  _tag: "DateInterval" as const,
  from: "2026-09-01",
  to: "2026-10-01",
};

const documentFor = (subjects: readonly string[]) =>
  canonicalJson({
    records: subjects.map((key, index) => ({
      externalId: `row-${key}`,
      predicate: "obligation.amount",
      subjectKey: key,
      validTime: interval,
      value: {
        _tag: "Known",
        amount: String(100 + index * 10),
        currency: "BRL",
      },
    })),
    schemaVersion: "d01.v1",
    source: {
      externalId: "ledger",
      label: "Ledger",
      namespace: "review",
      revision: "1",
    },
  });

const partitionAway = (
  frame: {
    cells: readonly {
      cellRef: string;
      components: readonly { members: readonly string[] }[];
    }[];
  },
  anchor: string
) =>
  frame.cells.map((cell) => {
    const component = cell.components.find((item) =>
      item.members.includes(anchor)
    );
    const members = component?.members ?? [anchor];
    const others = members.filter((member) => member !== anchor);
    return {
      blocks:
        others.length === 0 ? [members.slice()] : [[anchor], others.slice()],
      cellRef: cell.cellRef,
    };
  });

/** Adversarial EX27 writer review — not a happy-path re-run of handlers-split. */
it.live(
  "independent: split rejects stranger/foreign member, recovery split works, opId intent conflicts",
  () =>
    withD01IdentityDatabase((fixture) =>
      withStorage(({ config: storage }) =>
        Effect.gen(function* adversarialSplit() {
          const owner = yield* createAccount(fixture.config.baseUrl);
          const stranger = yield* createAccount(fixture.config.baseUrl);
          const executor = yield* SemanticExecutor;
          const created = yield* executor
            .execute(
              owner.credential,
              yield* bytes({
                ...d01,
                input: {},
                operation: "CreatePersonalWorld",
                operationId: randomUUID(),
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
          const { worldRef } = created;
          yield* executor.execute(
            owner.credential,
            yield* bytes({
              ...d01,
              input: { document: yield* documentFor(["A", "B", "C"]) },
              operation: "ImportEvidence",
              operationId: randomUUID(),
              worldRef,
            })
          );

          const inspectNow = Effect.fn("review.inspectNow")(function* () {
            return yield* executor
              .executeSubjectIdentity(
                owner.credential,
                yield* bytes({
                  ...envelope,
                  input: {
                    anchors: ["A", "B"],
                    atFrame: null,
                    interval,
                  },
                  operation: "InspectSubjectIdentity",
                  worldRef,
                })
              )
              .pipe(
                Effect.flatMap(
                  Schema.decodeUnknownEffect(SubjectIdentityInspected)
                )
              );
          });

          const first = yield* inspectNow();
          const merge = yield* executor
            .executeSubjectIdentity(
              owner.credential,
              yield* bytes({
                ...envelope,
                input: {
                  frame: {
                    frameRef: first.frame.frameRef,
                    kind: "subject-identity",
                  },
                  left: "A",
                  right: "B",
                },
                operation: "ProposeIdentityResolution",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed)));
          yield* executor
            .executeSubjectIdentity(
              owner.credential,
              yield* bytes({
                ...envelope,
                input: {
                  answer: "same-as",
                  consequenceDigest: merge.question.consequenceDigest,
                  questionRef: merge.question.questionRef,
                },
                operation: "ResolveIdentity",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityResolved)));

          const merged = yield* inspectNow();
          const smuggled = yield* executor
            .executeSubjectIdentity(
              owner.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchor: "A",
                  frame: {
                    frameRef: merged.frame.frameRef,
                    kind: "subject-identity",
                  },
                  partitionsByCell: merged.frame.cells.map((cell) => ({
                    blocks: [["A"], ["B", "C"]],
                    cellRef: cell.cellRef,
                  })),
                },
                operation: "ProposeIdentitySplit",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed)));
          expect(smuggled.question.blockedAlternatives).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                answer: "confirm",
                reason: "InvalidPartition",
              }),
            ])
          );

          const forStranger = yield* inspectNow();
          const strangerDenied = yield* executor
            .executeSubjectIdentity(
              stranger.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchor: "A",
                  frame: {
                    frameRef: forStranger.frame.frameRef,
                    kind: "subject-identity",
                  },
                  partitionsByCell: partitionAway(forStranger.frame, "A"),
                },
                operation: "ProposeIdentitySplit",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flip);
          expect(strangerDenied._tag).toBe("NotFoundOrDenied");

          const forSplit = yield* inspectNow();
          const splitOpId = randomUUID();
          const partitionsByCell = partitionAway(forSplit.frame, "A");
          const proposed = yield* executor
            .executeSubjectIdentity(
              owner.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchor: "A",
                  frame: {
                    frameRef: forSplit.frame.frameRef,
                    kind: "subject-identity",
                  },
                  partitionsByCell,
                },
                operation: "ProposeIdentitySplit",
                operationId: splitOpId,
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed)));

          const replay = yield* executor
            .executeSubjectIdentity(
              owner.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchor: "A",
                  frame: {
                    frameRef: forSplit.frame.frameRef,
                    kind: "subject-identity",
                  },
                  partitionsByCell,
                },
                operation: "ProposeIdentitySplit",
                operationId: splitOpId,
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed)));
          expect(replay.receiptRef).toBe(proposed.receiptRef);
          expect(replay.question.questionRef).toBe(
            proposed.question.questionRef
          );

          const conflict = yield* executor
            .executeSubjectIdentity(
              owner.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchor: "B",
                  frame: {
                    frameRef: forSplit.frame.frameRef,
                    kind: "subject-identity",
                  },
                  partitionsByCell,
                },
                operation: "ProposeIdentitySplit",
                operationId: splitOpId,
                worldRef,
              })
            )
            .pipe(Effect.flip);
          expect(conflict._tag).toBe("Conflict");

          const applied = yield* executor
            .executeSubjectIdentity(
              owner.credential,
              yield* bytes({
                ...envelope,
                input: {
                  answer: "confirm",
                  consequenceDigest: proposed.question.consequenceDigest,
                  questionRef: proposed.question.questionRef,
                },
                operation: "ResolveIdentity",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityResolved)));
          expect(applied.outcome).toBe("applied");

          const recovery = yield* executor
            .executeSubjectIdentity(
              owner.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchor: "A",
                  atFrame: null,
                  interval,
                  targetDecisionRef: applied.decisionRef,
                },
                operation: "InspectIdentityRecovery",
                worldRef,
              })
            )
            .pipe(
              Effect.flatMap(
                Schema.decodeUnknownEffect(IdentityRecoveryInspected)
              )
            );
          expect(recovery.frame.kind).toBe("subject-identity-recovery");

          const before = yield* Effect.gen(function* count() {
            const sql = yield* SqlClient.SqlClient;
            const [row] = yield* sql`
              SELECT count(*)::int AS n FROM authority.identity_decisions
              WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
            `;
            return Number((row as { n: number }).n);
          }).pipe(Effect.provide(fixture.database.authority));
          const recoveryBlocked = yield* executor
            .executeSubjectIdentity(
              owner.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchor: "A",
                  frame: {
                    frameRef: recovery.frame.frameRef,
                    kind: "subject-identity-recovery",
                  },
                  partitionsByCell: recovery.frame.cells.map((cell) => {
                    const component = cell.components.find((item) =>
                      item.members.includes("A")
                    );
                    return {
                      blocks: [component?.members ?? ["A"]],
                      cellRef: cell.cellRef,
                    };
                  }),
                },
                operation: "ProposeIdentitySplit",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed)));
          expect(recoveryBlocked.question.kind).toBe("identity-recovery-split");
          expect(recoveryBlocked.question.blockedAlternatives).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                answer: "confirm",
                reason: "InvalidPartition",
              }),
            ])
          );
          // Blocked propose still creates a Case (advances cases) but must not write identity decisions.
          const after = yield* Effect.gen(function* count() {
            const sql = yield* SqlClient.SqlClient;
            const [row] = yield* sql`
              SELECT count(*)::int AS n FROM authority.identity_decisions
              WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
            `;
            return Number((row as { n: number }).n);
          }).pipe(Effect.provide(fixture.database.authority));
          expect(after).toBe(before);

          yield* postAuth(
            fixture.config.baseUrl,
            "sign-out",
            {},
            owner.credential
          );
          yield* postAuth(
            fixture.config.baseUrl,
            "sign-out",
            {},
            stranger.credential
          );
        }).pipe(
          Effect.provide(
            Layer.provideMerge(
              SemanticExecutor.layer,
              Layer.mergeAll(
                configuration,
                fixture.runtime,
                fixture.database.authority,
                s3EvidenceLayer(storage)
              )
            )
          )
        )
      )
    ),
  { timeout: 120_000 }
);
