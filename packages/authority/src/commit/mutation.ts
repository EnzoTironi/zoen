import { Conflict, Stale, Unavailable } from "@zoen/contracts/d01/errors";
import type { D01Error } from "@zoen/contracts/d01/errors";
import {
  Digest,
  ReceiptRef,
  Revision,
  exact,
} from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql";

import { validateContext, withinRequestDeadline } from "../access/context.js";
import { authorizeWorld } from "../access/world.js";
import { DomainKey } from "../ports/d01/basis.js";
import type { DomainCut, InternalBasis } from "../ports/d01/basis.js";
import type { VerifiedRequestContext } from "../ports/d01/context.js";
import type { StoredOperationResult } from "../ports/d01/persistence.js";
import { intentDigest } from "../values/canonical.js";
import { AuthorityInstallation } from "./configuration.js";
import { readCut, validateBasis } from "./guards.js";
import type { BoundWorldIntent } from "./intent.js";
import { newReceiptRef, persistReceipt, readReceipt } from "./receipt.js";
import { serializable } from "./transaction.js";

const OperationRow = Schema.Struct({
  intent_digest: Digest,
  receipt_id: ReceiptRef,
}).annotate(exact);

export interface MutationOutcome {
  readonly result: typeof StoredOperationResult.Type;
  readonly changedDomains: readonly (typeof DomainKey.Type)[];
}

export interface MutationPlan {
  readonly basis: InternalBasis | null;
  readonly domains: readonly (typeof DomainKey.Type)[];
  readonly apply: (
    receiptRef: typeof ReceiptRef.Type,
    cut: DomainCut
  ) => Effect.Effect<
    MutationOutcome,
    D01Error | SqlError.SqlError,
    SqlClient.SqlClient
  >;
}

/** A semantic SQL mutation. Captures and all provider calls precede this boundary. */
export const commitMutation = Effect.fn("authority.commit.commitMutation")(
  function* commitMutation(
    context: VerifiedRequestContext,
    bound: BoundWorldIntent,
    plan: MutationPlan
  ) {
    const { request } = bound;
    const { worldRef } = request;
    if ((yield* intentDigest(request)) !== bound.digest) {
      return yield* new Conflict({ code: "CONFLICT" });
    }
    const domains = yield* Schema.decodeEffect(Schema.Array(DomainKey))(
      plan.domains
    ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const lockedDomains = [...new Set(domains)].toSorted();
    const receiptRef = yield* newReceiptRef();
    const sql = yield* SqlClient.SqlClient;
    const installation = yield* AuthorityInstallation;
    const result = yield* serializable(
      Effect.gen(function* applyMutation() {
        yield* sql`
        SELECT world_id FROM authority.worlds
        WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm} FOR SHARE
      `;
        const access = yield* authorizeWorld(context, worldRef);
        if (
          access.cell_id !== installation.cellId ||
          access.cell_epoch !== installation.cellEpoch ||
          access.release_digest !== installation.releaseDigest ||
          access.generation_id !== installation.generationId
        ) {
          return yield* new Stale({ code: "STALE" });
        }
        const key = `operation:${worldRef.realm}:${worldRef.worldId}:${context.presence.principalId}:${request.operation}:${request.operationId}`;
        yield* sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
        for (const domain of lockedDomains) {
          yield* sql`
          SELECT version FROM authority.domains
          WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
            AND domain_key = ${domain} FOR UPDATE
        `;
        }
        yield* sql`
        SELECT revision FROM authority.memberships
        WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
          AND principal_id = ${context.presence.principalId} FOR SHARE
      `;
        yield* authorizeWorld(context, worldRef);
        const [existing] = yield* sql`
        SELECT intent_digest, receipt_id FROM authority.operations
        WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm}
          AND principal_id = ${context.presence.principalId}
          AND semantic_operation = ${request.operation} AND operation_id = ${request.operationId}
      `;
        if (existing !== undefined) {
          const row = yield* Schema.decodeUnknownEffect(OperationRow)(
            existing
          ).pipe(
            Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
          );
          if (row.intent_digest !== bound.digest) {
            return yield* new Conflict({ code: "CONFLICT" });
          }
          return yield* readReceipt(
            context,
            worldRef,
            row.receipt_id,
            request.operation
          );
        }
        const cut = yield* readCut(worldRef);
        if (plan.basis !== null) {
          yield* validateBasis(plan.basis, {
            cut,
            head: {
              cellEpoch: access.cell_epoch,
              generationId: access.generation_id,
              releaseDigest: access.release_digest,
              securityRevision: access.security_revision,
            },
            membershipRevision: access.membership_revision,
            worldRef,
          });
        }
        yield* sql`
        INSERT INTO authority.operations
          (world_id, realm, principal_id, semantic_operation, operation_id, intent_digest, receipt_id)
        VALUES (${worldRef.worldId}, ${worldRef.realm}, ${context.presence.principalId},
          ${request.operation}, ${request.operationId}, ${bound.digest}, ${receiptRef})
        ON CONFLICT (world_id, realm, principal_id, semantic_operation, operation_id) DO NOTHING
      `;
        const applied = yield* plan.apply(receiptRef, cut);
        const changed = yield* Schema.decodeEffect(Schema.Array(DomainKey))(
          applied.changedDomains
        ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
        const changedDomains = [...new Set(changed)].toSorted();
        if (changedDomains.some((domain) => !lockedDomains.includes(domain))) {
          return yield* new Unavailable({ code: "UNAVAILABLE" });
        }
        const nextCut = { ...cut };
        for (const domain of changedDomains) {
          const version = yield* Schema.decodeEffect(Revision)(
            (BigInt(cut[domain]) + 1n).toString()
          ).pipe(
            Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
          );
          yield* sql`
            UPDATE authority.domains SET version = ${version}
            WHERE world_id = ${worldRef.worldId} AND realm = ${worldRef.realm} AND domain_key = ${domain}
          `;
          nextCut[domain] = version;
        }
        yield* authorizeWorld(context, worldRef);
        const receipt = yield* persistReceipt({
          context,
          cut: nextCut,
          operation: request.operation,
          receiptRef,
          result: applied.result,
          worldRef,
        });
        yield* validateContext(context);
        return receipt;
      }).pipe(withinRequestDeadline(context))
    );
    yield* authorizeWorld(context, worldRef);
    return result;
  }
);
