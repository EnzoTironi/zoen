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
import { SemanticExecutor } from "../../../../packages/authority/src/semantic/executor.js";
import { canonicalJson } from "../../../../packages/authority/src/values/canonical.js";
import {
  IdentityProposed,
  IdentityResolved,
  SubjectIdentityInspected,
  IdentityRecoveryInspected,
} from "../../../../packages/contracts/src/subject-identity/operations.js";
import { WorldCreated } from "../../../../packages/contracts/src/worlds/operations.js";
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

const documentFor = (subjects: readonly { key: string; amount: string }[]) =>
  canonicalJson({
    records: subjects.map((subject, _index) => ({
      externalId: `row-${subject.key}`,
      predicate: "obligation.amount",
      subjectKey: subject.key,
      validTime: {
        _tag: "DateInterval",
        from: "2026-09-01",
        to: "2026-10-01",
      },
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

it.live(
  "EX27 inspects identity graph, proposes/resolves same-as, guards absence, recovers and undoes",
  () =>
    withIdentityDatabase((fixture) =>
      withStorage(({ config: storage }) =>
        Effect.gen(function* identityCore() {
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

          const inspected = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchors: ["A", "B"],
                  atFrame: null,
                  interval: {
                    _tag: "DateInterval",
                    from: "2026-09-01",
                    to: "2026-10-01",
                  },
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
          expect(inspected.frame.kind).toBe("subject-identity");
          expect(inspected.frame.closureAnchors).toStrictEqual(["A", "B"]);
          expect(inspected.frame.claims).toHaveLength(2);
          expect(inspected.frame.cells.length).toBeGreaterThan(0);
          const pinCount = yield* Effect.gen(function* countPins() {
            const sql = yield* SqlClient.SqlClient;
            const [row] = yield* sql`
              SELECT count(*)::int AS n FROM authority.pins
              WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
                AND owner_kind = 'frame' AND owner_id = ${inspected.frame.frameRef}
            `;
            return countOf(row);
          }).pipe(Effect.provide(fixture.database.authority));
          expect(pinCount).toBeGreaterThan(0);
          expect(
            inspected.frame.claims.every(
              (claim) => claim.subjectKey === "A" || claim.subjectKey === "B"
            )
          ).toBeTruthy();

          const proposed = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  frame: {
                    frameRef: inspected.frame.frameRef,
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
          expect(proposed.question.kind).toBe("identity-resolution");
          const same = proposed.question.alternatives.find(
            (item) => item.answer === "same-as"
          );
          expect(same).toBeDefined();
          expect(same?.effectItems.length).toBeGreaterThan(0);

          const resolved = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  answer: "same-as",
                  consequenceDigest: proposed.question.consequenceDigest,
                  questionRef: proposed.question.questionRef,
                },
                operation: "ResolveIdentity",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityResolved)));
          expect(resolved.outcome).toBe("applied");
          expect(resolved.decisionRef).not.toBeNull();

          const after = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchors: ["A", "B"],
                  atFrame: null,
                  interval: {
                    _tag: "DateInterval",
                    from: "2026-09-01",
                    to: "2026-10-01",
                  },
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
          expect(
            after.frame.cells.some((cell) =>
              cell.components.some(
                (component) =>
                  component.members.includes(subjectKey("A")) &&
                  component.members.includes(subjectKey("B"))
              )
            )
          ).toBeTruthy();

          const recovery = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchor: "A",
                  atFrame: null,
                  interval: {
                    _tag: "DateInterval",
                    from: "2026-09-01",
                    to: "2026-10-01",
                  },
                  targetDecisionRef: resolved.decisionRef,
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
          expect(recovery.frame.comparison).toBe("not-requested");
          expect(recovery.frame).not.toHaveProperty("claims");

          const undoProposed = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  frame: {
                    frameRef: recovery.frame.frameRef,
                    kind: "subject-identity-recovery",
                  },
                  targetDecisionRef: resolved.decisionRef,
                },
                operation: "ProposeIdentityUndo",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityProposed)));
          expect(undoProposed.question.kind).toBe("identity-recovery-undo");

          yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  answer: "confirm",
                  consequenceDigest: undoProposed.question.consequenceDigest,
                  questionRef: undoProposed.question.questionRef,
                },
                operation: "ResolveIdentity",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flatMap(Schema.decodeUnknownEffect(IdentityResolved)));

          // Absence / serialization guard: concurrent identity bump stale-s a retained propose.
          const fresh = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  anchors: ["A", "B"],
                  atFrame: null,
                  interval: {
                    _tag: "DateInterval",
                    from: "2026-09-01",
                    to: "2026-10-01",
                  },
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
          const stalePropose = yield* executor
            .executeSubjectIdentity(
              account.credential,
              yield* bytes({
                ...envelope,
                input: {
                  frame: {
                    frameRef: fresh.frame.frameRef,
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
                  answer: "same-as",
                  consequenceDigest: stalePropose.question.consequenceDigest,
                  questionRef: stalePropose.question.questionRef,
                },
                operation: "ResolveIdentity",
                operationId: randomUUID(),
                worldRef,
              })
            )
            .pipe(Effect.flip);
          expect(stale._tag).toBe("Stale");

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
    )
);
