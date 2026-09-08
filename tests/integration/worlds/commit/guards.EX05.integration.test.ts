import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { SemanticError } from "../../../../packages/contracts/src/worlds/errors.js";
import { ImportEvidence } from "../../../../packages/contracts/src/worlds/operations.js";
import { WorldRef } from "../../../../packages/contracts/src/worlds/values.js";
import { authorizeWorld } from "../../../../packages/ontology/src/access/world.js";
import { createPersonalWorld } from "../../../../packages/ontology/src/commit/genesis.js";
import {
  readCut,
  validateBasis,
} from "../../../../packages/ontology/src/commit/guards.js";
import { bindWorldIntent } from "../../../../packages/ontology/src/commit/intent.js";
import { commitMutation } from "../../../../packages/ontology/src/commit/mutation.js";
import {
  CurrentInternalBasis,
  ReadSet,
} from "../../../../packages/ontology/src/ports/worlds/basis.js";
import { VerifiedRequestContext } from "../../../../packages/ontology/src/ports/worlds/context.js";
import {
  canonicalJson,
  structuredDigest,
} from "../../../../packages/ontology/src/values/canonical.js";
import { configuration, makeInput } from "./fixture.js";

it.live(
  "EX05 changed predicate/domain basis rejects a mutation without recomputing its consent",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* staleBasis() {
        const { context, request } = yield* makeInput();
        const created = yield* createPersonalWorld(context, request);
        const access = yield* authorizeWorld(context, created.worldRef);
        const cut = yield* readCut(created.worldRef);
        const readSet = yield* Schema.decodeEffect(ReadSet)({
          clockSample: {
            observedAt: DateTime.formatIso(yield* DateTime.now),
            uncertaintyMillis: 0,
          },
          identities: [],
          membershipRevision: access.membership_revision,
          predicates: [
            {
              domain: "claims",
              predicate: "obligation.amount",
              subjectKey: "invoice-1",
              version: cut.claims,
            },
          ],
          schemaVersion: "authority.read-set.v2",
          sources: [],
          temporalGuards: [],
        });
        const basis = yield* Schema.decodeEffect(CurrentInternalBasis)({
          cut,
          head: {
            cellEpoch: access.cell_epoch,
            generationId: access.generation_id,
            releaseDigest: access.release_digest,
            securityRevision: access.security_revision,
          },
          readSet,
          readSetDigest: yield* structuredDigest("read-set", readSet),
          schemaVersion: "authority.basis.v2",
          worldRef: created.worldRef,
        });
        yield* validateBasis(basis, {
          cut,
          head: basis.head,
          membershipRevision: access.membership_revision,
          principalId: context.presence.principalId,
          purpose: context.purpose,
          worldRef: created.worldRef,
        });
        const document = yield* canonicalJson({
          records: [
            {
              externalId: "invoice-1",
              predicate: "obligation.amount",
              subjectKey: "invoice-1",
              validTime: { _tag: "Unknown" },
              value: { _tag: "Known", amount: "100.00", currency: "BRL" },
            },
          ],
          schemaVersion: "worlds.v1",
          source: {
            externalId: "statement",
            label: "Statement",
            namespace: "test",
            revision: "1",
          },
        });
        const mutation = yield* Schema.decodeEffect(ImportEvidence)({
          input: { document },
          operation: "ImportEvidence",
          operationId: randomUUID(),
          purpose: "personal-records",
          schemaVersion: "worlds.v1",
          worldRef: created.worldRef,
        });
        const bound = yield* bindWorldIntent(mutation);
        const sql = yield* SqlClient.SqlClient;
        yield* sql`UPDATE authority.domains SET version = version + 1 WHERE world_id = ${created.worldRef.worldId} AND realm = 'live' AND domain_key = 'claims'`;
        const error = yield* commitMutation(context, bound, {
          apply: () =>
            Effect.die(
              new Error("The writer must not execute under a stale basis")
            ),
          basis,
          domains: ["claims"],
        }).pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "Stale", code: "STALE" });
        expect(basis.cut.claims).toBe("0");
        expect(
          yield* sql`SELECT count(*)::int AS count FROM authority.operations`
        ).toStrictEqual([{ count: 0 }]);
        expect(
          yield* sql`SELECT count(*)::int AS count FROM authority.receipts`
        ).toStrictEqual([{ count: 1 }]);
        expect(
          yield* sql`SELECT version::int FROM authority.domains WHERE world_id = ${created.worldRef.worldId} AND realm = 'live' AND domain_key = 'claims'`
        ).toStrictEqual([{ version: 1 }]);
      }).pipe(Effect.provide(Layer.mergeAll(configuration, database.authority)))
    )
);

it.live(
  "EX05 another principal and an absent world have the same denial envelope",
  () =>
    withWorldsDatabase((database) =>
      Effect.gen(function* privateWorldDenial() {
        const { context, request } = yield* makeInput();
        const created = yield* createPersonalWorld(context, request);
        const other = yield* Schema.decodeEffect(VerifiedRequestContext)({
          ...context,
          presence: { ...context.presence, principalId: randomUUID() },
        });
        const missing = yield* Schema.decodeEffect(WorldRef)({
          realm: "live",
          worldId: randomUUID(),
        });
        const denied = yield* authorizeWorld(other, created.worldRef).pipe(
          Effect.flip
        );
        const absent = yield* authorizeWorld(other, missing).pipe(Effect.flip);
        const deniedJson =
          yield* Schema.encodeUnknownEffect(SemanticError)(denied);
        const absentJson =
          yield* Schema.encodeUnknownEffect(SemanticError)(absent);
        expect(yield* canonicalJson(deniedJson)).toBe(
          yield* canonicalJson(absentJson)
        );
        expect(denied).toMatchObject({
          _tag: "NotFoundOrDenied",
          code: "NOT_FOUND_OR_DENIED",
        });
      }).pipe(Effect.provide(Layer.mergeAll(configuration, database.authority)))
    )
);
