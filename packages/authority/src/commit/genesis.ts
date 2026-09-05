import { randomUUID } from "node:crypto";

import { InvalidInput, Unavailable } from "@zoen/contracts/d01/errors";
import {
  CreatePersonalWorld,
  WorldCreated,
} from "@zoen/contracts/d01/operations";
import {
  Digest,
  ReceiptRef,
  WorldRef,
  exact,
} from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { validateContext, withinRequestDeadline } from "../access/context.js";
import { authorizeWorld } from "../access/world.js";
import { DomainCut } from "../ports/d01/basis.js";
import { DataPolicy } from "../ports/d01/context.js";
import type { VerifiedRequestContext } from "../ports/d01/context.js";
import { intentDigest } from "../values/canonical.js";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "./configuration.js";
import { requireSameIntent } from "./idempotency.js";
import { newReceiptRef, persistReceipt, readReceipt } from "./receipt.js";
import { serializable } from "./transaction.js";

const BootstrapRow = Schema.Struct({
  intent_digest: Digest,
  realm: Schema.Literal("live"),
  receipt_id: ReceiptRef,
  world_id: WorldRef.members[0].fields.worldId,
}).annotate(exact);

const initialCut = Schema.decodeSync(DomainCut)({
  cases: "0",
  claims: "0",
  evidence: "0",
  membership: "0",
  sources: "0",
});

export const createPersonalWorld = Effect.fn(
  "authority.commit.createPersonalWorld"
)(function* createPersonalWorld(
  context: VerifiedRequestContext,
  input: typeof CreatePersonalWorld.Type
) {
  yield* validateContext(context);
  const request = yield* Schema.decodeEffect(CreatePersonalWorld)(input).pipe(
    Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
  );
  const digest = yield* intentDigest(request);
  const installation = yield* Schema.decodeEffect(AuthorityInstallationSchema)(
    yield* AuthorityInstallation
  ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
  const policy = yield* DataPolicy;
  const worldRef = yield* Schema.decodeEffect(WorldRef)({
    realm: "live",
    worldId: randomUUID(),
  }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
  const receiptRef = yield* newReceiptRef();
  const sql = yield* SqlClient.SqlClient;
  const result = yield* serializable(
    Effect.gen(function* commitGenesis() {
      yield* validateContext(context);
      const lockKey = `genesis:${context.presence.principalId}:${request.operationId}`;
      yield* sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      yield* validateContext(context);
      const [existing] = yield* sql`
        SELECT intent_digest, world_id, realm, receipt_id
        FROM authority.bootstrap_operations
        WHERE principal_id = ${context.presence.principalId}
          AND operation_id = ${request.operationId}
      `;
      if (existing !== undefined) {
        const row = yield* Schema.decodeUnknownEffect(BootstrapRow)(
          existing
        ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
        const existingWorld = { realm: row.realm, worldId: row.world_id };
        yield* authorizeWorld(context, existingWorld);
        yield* requireSameIntent(row.intent_digest, digest);
        return yield* readReceipt(
          context,
          existingWorld,
          row.receipt_id,
          request.operation
        );
      }
      yield* sql`
        INSERT INTO authority.bootstrap_operations
          (principal_id, operation_id, intent_digest, world_id, realm, receipt_id, semantic_operation)
        VALUES (${context.presence.principalId}, ${request.operationId}, ${digest},
          ${worldRef.worldId}, ${worldRef.realm}, ${receiptRef}, ${request.operation})
        ON CONFLICT (principal_id, operation_id) DO NOTHING
      `;
      yield* sql`
        INSERT INTO authority.worlds
          (world_id, realm, cell_id, cell_epoch, release_digest, generation_id,
           security_revision, emergency_deny, data_policy_id, created_at)
        VALUES (${worldRef.worldId}, ${worldRef.realm}, ${installation.cellId},
          ${installation.cellEpoch}, ${installation.releaseDigest}, ${installation.generationId},
          0, false, ${policy.profileId}, clock_timestamp())
      `;
      yield* sql`
        INSERT INTO authority.memberships (world_id, realm, principal_id, state, revision, role)
        VALUES (${worldRef.worldId}, ${worldRef.realm}, ${context.presence.principalId}, 'active', 0, 'owner')
      `;
      for (const domain of Object.keys(initialCut)) {
        yield* sql`
          INSERT INTO authority.domains (world_id, realm, domain_key, version)
          VALUES (${worldRef.worldId}, ${worldRef.realm}, ${domain}, 0)
        `;
      }
      const receipt = yield* persistReceipt({
        context,
        cut: initialCut,
        operation: request.operation,
        receiptRef,
        result: { _tag: "WorldCreated", receiptRef, worldRef },
        worldRef,
      });
      yield* validateContext(context);
      return receipt;
    }).pipe(withinRequestDeadline(context))
  );
  const created = yield* Schema.decodeUnknownEffect(WorldCreated)(result).pipe(
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );
  yield* authorizeWorld(context, created.worldRef);
  return created;
});
