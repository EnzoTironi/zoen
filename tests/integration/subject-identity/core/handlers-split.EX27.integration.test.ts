import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { SubjectKey } from "@zoen/contracts/worlds/values";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { layer as s3EvidenceLayer } from "../../../../apps/server/src/adapters/object-storage/worlds/s3.js";
import { withStorage } from "../../../../apps/server/test/adapters/object-storage/worlds/fixture.js";
import { withIdentityDatabase } from "../../../../apps/server/test/identity/worlds/database.js";
import {
  createAccount,
  postAuth,
} from "../../../../apps/server/test/identity/worlds/http.js";
import {
  IdentityProposed,
  IdentityResolved,
  SubjectIdentityInspected,
} from "../../../../packages/contracts/src/subject-identity/operations.js";
import { WorldCreated } from "../../../../packages/contracts/src/worlds/operations.js";
import { SemanticExecutor } from "../../../../packages/ontology/src/semantic/executor.js";
import { canonicalJson } from "../../../../packages/ontology/src/values/canonical.js";
import { configuration } from "../../worlds/commit/fixture.js";

const subjectKey = Schema.decodeSync(SubjectKey);

const CountRow = Schema.Struct({ n: Schema.Finite });
const countOf = (row: unknown) => Schema.decodeUnknownSync(CountRow)(row).n;

const bytes = (value: unknown) =>
  canonicalJson(value).pipe(
    Effect.map((json) => new TextEncoder().encode(json))
  );

const envelope = {
  purpose: "personal-records" as const,
  schemaVersion: "subject-identity.v1" as const,
};
const worldsBasis = {
  purpose: "personal-records" as const,
  schemaVersion: "worlds.v1" as const,
};
const interval = {
  _tag: "DateInterval" as const,
  from: "2026-09-01",
  to: "2026-10-01",
};

const documentFor = (subjects: readonly { key: string; amount: string }[]) =>
  canonicalJson({
    records: subjects.map((subject) => ({
      externalId: `row-${subject.key}`,
      predicate: "obligation.amount",
      subjectKey: subject.key,
      validTime: interval,
      value: { _tag: "Known", amount: subject.amount, currency: "BRL" },
    })),
    schemaVersion: "worlds.v1",
    source: {
      externalId: "billing",
      label: "Billing",
      namespace: "test",
      revision: "1",
    },
  });

const partitionAnchorAway = (
  frame: (typeof SubjectIdentityInspected.Type)["frame"],
  anchor: typeof SubjectKey.Type
) =>
  frame.cells.map((cell) => {
    const component = cell.components.find((item) =>
      item.members.includes(anchor)
    );
    if (component === undefined) {
      throw new Error(`missing component for ${anchor}`);
    }
    const others = component.members.filter((member) => member !== anchor);
    const blocks =
      others.length === 0 ? [[...component.members]] : [[anchor], [...others]];
    return { blocks, cellRef: cell.cellRef };
  });

it.live(
  "EX27 ProposeIdentitySplit applies partition, blocks invalid cover, and Stales retained confirm",
  () =>
    withIdentityDatabase((fixture) =>
      withStorage(({ config: storage }) =>
        Effect.gen(function* splitCore() {
          const account = yield* createAccount(fixture.config.baseUrl);
          const executor = yield* SemanticExecutor;
          const created = yield* executor
            .execute(
              account.credential,
              yield* bytes({
                ...worldsBasis,
                input: {},
                operation: "CreatePersonalWorld",
                operationId: randomUUID(),
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated)));
          const { worldRef } = created;
          yield* executor.execute(
            account.credential,
            yield* bytes({
              ...worldsBasis,
              input: {
                document: yield* documentFor([
                  { amount: "100", key: "A" },
                  { amount: "120", key: "B" },
                ]),
              },
              operation: "ImportEvidence",
              operationId: randomUUID(),
              worldRef,
            })
          );

          const inspectNow = Effect.fn("test.inspectNow")(
            function* inspectNow() {
              return yield* executor
                .executeSubjectIdentity(
                  account.credential,
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
            }
          );

          const first = yield* inspectNow();
          const proposedSame = yield* executor
            .executeSubjectIdentity(
              account.credential,
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
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  answer: "same-as",
                  consequenceDigest: proposedSame.question.consequenceDigest,
                  questionRef: proposedSame.question.questionRef,
                },
                operation: "ResolveIdentity",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityResolved)));

          const merged = yield* inspectNow();
          expect(
            merged.frame.cells.some((cell) =>
              cell.components.some(
                (component) =>
                  component.members.includes(subjectKey("A")) &&
                  component.members.includes(subjectKey("B"))
              )
            )
          ).toBeTruthy();

          const invalid = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchor: "A",
                  frame: {
                    frameRef: merged.frame.frameRef,
                    kind: "subject-identity",
                  },
                  partitionsByCell: merged.frame.cells.map((cell) => ({
                    blocks: [["A"]],
                    cellRef: cell.cellRef,
                  })),
                },
                operation: "ProposeIdentitySplit",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed)));
          expect(invalid.question.kind).toBe("identity-split");
          expect(invalid.question.blockedAlternatives).toStrictEqual(
            expect.arrayContaining([
              expect.objectContaining({
                answer: "confirm",
                reason: "InvalidPartition",
              }),
            ])
          );
          expect(
            invalid.question.alternatives.some(
              (item) => item.answer === "confirm"
            )
          ).toBeFalsy();

          // Propose advances cases — need a fresh Frame before the real split.
          const forSplit = yield* inspectNow();
          const proposedSplit = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchor: "A",
                  frame: {
                    frameRef: forSplit.frame.frameRef,
                    kind: "subject-identity",
                  },
                  partitionsByCell: partitionAnchorAway(
                    forSplit.frame,
                    subjectKey("A")
                  ),
                },
                operation: "ProposeIdentitySplit",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed)));
          expect(proposedSplit.question.kind).toBe("identity-split");
          const confirm = proposedSplit.question.alternatives.find(
            (item) => item.answer === "confirm"
          );
          expect(confirm).toBeDefined();
          expect(
            confirm?.effectItems.some((item) => item._tag === "Withdraw")
          ).toBeTruthy();
          expect(
            confirm?.effectItems.some(
              (item) =>
                item._tag === "Assert" && item.relation === "different-from"
            )
          ).toBeTruthy();

          // Stronger Stale/absence before apply: bump identity, confirm must Stale with no decision row.
          const beforeStale = yield* Effect.gen(function* count() {
            const sql = yield* SqlClient.SqlClient;
            const [row] = yield* sql`
              SELECT count(*)::int AS n FROM authority.identity_decisions
              WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
            `;
            return countOf(row);
          }).pipe(Effect.provide(fixture.database.authority));
          yield* Effect.gen(function* bumpIdentity() {
            const sql = yield* SqlClient.SqlClient;
            yield* sql`
              UPDATE authority.domains
              SET version = version + 1
              WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
                AND domain_key = 'identity'
            `;
          }).pipe(Effect.provide(fixture.database.authority));
          const stale = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  answer: "confirm",
                  consequenceDigest: proposedSplit.question.consequenceDigest,
                  questionRef: proposedSplit.question.questionRef,
                },
                operation: "ResolveIdentity",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flip);
          expect(stale._tag).toBe("Stale");
          const afterStale = yield* Effect.gen(function* count() {
            const sql = yield* SqlClient.SqlClient;
            const [row] = yield* sql`
              SELECT count(*)::int AS n FROM authority.identity_decisions
              WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
            `;
            return countOf(row);
          }).pipe(Effect.provide(fixture.database.authority));
          expect(afterStale).toBe(beforeStale);

          // Fresh frame after the failed confirm — apply a real split.
          const forApply = yield* inspectNow();
          const applyPropose = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchor: "A",
                  frame: {
                    frameRef: forApply.frame.frameRef,
                    kind: "subject-identity",
                  },
                  partitionsByCell: partitionAnchorAway(
                    forApply.frame,
                    subjectKey("A")
                  ),
                },
                operation: "ProposeIdentitySplit",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed)));
          const decisionsBefore = yield* Effect.gen(function* count() {
            const sql = yield* SqlClient.SqlClient;
            const [row] = yield* sql`
              SELECT count(*)::int AS n FROM authority.identity_decisions
              WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
            `;
            return countOf(row);
          }).pipe(Effect.provide(fixture.database.authority));
          const resolvedSplit = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  answer: "confirm",
                  consequenceDigest: applyPropose.question.consequenceDigest,
                  questionRef: applyPropose.question.questionRef,
                },
                operation: "ResolveIdentity",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityResolved)));
          expect(resolvedSplit.outcome).toBe("applied");
          expect(resolvedSplit.decisionRef).not.toBeNull();
          const decisionsAfter = yield* Effect.gen(function* count() {
            const sql = yield* SqlClient.SqlClient;
            const [row] = yield* sql`
              SELECT count(*)::int AS n FROM authority.identity_decisions
              WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
            `;
            return countOf(row);
          }).pipe(Effect.provide(fixture.database.authority));
          expect(decisionsAfter).toBe(decisionsBefore + 1);

          const splitGraph = yield* inspectNow();
          expect(
            splitGraph.frame.cells.every(
              (cell) =>
                !cell.components.some(
                  (component) =>
                    component.members.includes(subjectKey("A")) &&
                    component.members.includes(subjectKey("B"))
                )
            )
          ).toBeTruthy();

          yield* postAuth(
            fixture.config.baseUrl,
            "sign-out",
            {},
            account.credential
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
