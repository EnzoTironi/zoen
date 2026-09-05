import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { Effect, Exit, Result } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withD01Database } from "./database.ts";
import { claimRow, seedEvidence } from "./seed.ts";

it.live(
  "D01 composite foreign keys reject cross World, cross realm and mismatched provenance",
  () =>
    withD01Database((database) =>
      Effect.gen(function* integrity() {
        const sql = yield* SqlClient.SqlClient;
        const a = yield* seedEvidence();
        const b = yield* seedEvidence();
        const evaluation = yield* seedEvidence(a.worldId, "evaluation");
        const control = claimRow(a);
        yield* sql`INSERT INTO authority.claims ${sql.insert(control)}`;
        for (const wrong of [
          { ...claimRow(a), evidence_id: b.evidence, source_id: b.source },
          {
            ...claimRow(a),
            evidence_id: evaluation.evidence,
            source_id: evaluation.source,
          },
          { ...claimRow(a), source_id: a.otherSource },
          { ...claimRow(a), introduced_receipt_id: b.receipt },
        ]) {
          const error =
            yield* sql`INSERT INTO authority.claims ${sql.insert(wrong)}`.pipe(
              Effect.flip
            );
          expect(error).toMatchObject({
            _tag: "SqlError",
            reason: { _tag: "ConstraintError" },
          });
        }
        const duplicate =
          yield* sql`INSERT INTO authority.claims ${sql.insert({ ...control, claim_id: randomUUID() })}`.pipe(
            Effect.flip
          );
        expect(duplicate).toMatchObject({
          _tag: "SqlError",
          reason: { _tag: "UniqueViolation" },
        });
        const wrongPin = yield* sql`INSERT INTO authority.pins ${sql.insert({
          created_at: "2026-09-05T00:00:00.000Z",
          evidence_id: b.evidence,
          owner_id: b.evidence,
          owner_kind: "evidence",
          realm: a.realm,
          world_id: a.worldId,
        })}`.pipe(Effect.flip);
        expect(wrongPin).toMatchObject({
          _tag: "SqlError",
          reason: { _tag: "ConstraintError" },
        });
        expect(yield* sql`SELECT claim_id FROM authority.claims`).toStrictEqual(
          [{ claim_id: control.claim_id }]
        );
      }).pipe(Effect.provide(database.authority))
    )
);

it.live(
  "D01 failed commit rolls back observed writes, deferred receipt references and domain counters",
  () =>
    withD01Database((database) =>
      Effect.gen(function* atomicity() {
        const sql = yield* SqlClient.SqlClient;
        const seed = yield* seedEvidence();
        const row = claimRow(seed);
        const failure = yield* sql
          .withTransaction(
            Effect.gen(function* invalidCommit() {
              yield* sql`INSERT INTO authority.claims ${sql.insert(row)}`;
              yield* sql`UPDATE authority.domains SET version = version + 1 WHERE world_id = ${seed.worldId} AND realm = ${seed.realm}`;
              yield* sql`INSERT INTO authority.operations ${sql.insert({
                intent_digest: "a".repeat(64),
                operation_id: randomUUID(),
                principal_id: seed.principal,
                realm: seed.realm,
                receipt_id: randomUUID(),
                semantic_operation: "ImportEvidence",
                world_id: seed.worldId,
              })}`;
              expect(
                yield* sql`SELECT claim_id FROM authority.claims`
              ).toStrictEqual([{ claim_id: row.claim_id }]);
            })
          )
          .pipe(Effect.exit);
        // RC112 commits in a finalizer with orDie; the original SQL error is a defect.
        expect(Result.getOrThrow(Exit.findDefect(failure))).toMatchObject({
          _tag: "SqlError",
          reason: { _tag: "ConstraintError" },
        });
        expect(yield* sql`SELECT claim_id FROM authority.claims`).toStrictEqual(
          []
        );
        expect(
          yield* sql`SELECT operation_id FROM authority.operations`
        ).toStrictEqual([]);
        expect(yield* sql`SELECT version FROM authority.domains`).toStrictEqual(
          [{ version: "0" }]
        );
      }).pipe(Effect.provide(database.authority))
    )
);
