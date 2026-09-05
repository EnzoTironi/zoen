import { randomUUID } from "node:crypto";

import { DomainCut } from "@zoen/authority/ports/d01/basis";
import { StoredOperationResult } from "@zoen/authority/ports/d01/persistence";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

/** Synthetic domain inputs inserted into the actual schema, not provider responses. */
export const seedEvidence = Effect.fn("seedEvidence")(function* seed(
  worldId: string = randomUUID(),
  realm: "live" | "evaluation" = "live"
) {
  const sql = yield* SqlClient.SqlClient;
  const principal = randomUUID();
  const receipt = randomUUID();
  const source = randomUUID();
  const otherSource = randomUUID();
  const evidence = randomUUID();
  const capture = randomUUID();
  const result = yield* Schema.decodeEffect(StoredOperationResult)({
    _tag: "WorldCreated",
    receiptRef: receipt,
    worldRef: { realm, worldId },
  });
  const cut = yield* Schema.decodeEffect(DomainCut)({
    cases: "0",
    claims: "0",
    evidence: "0",
    membership: "0",
    sources: "0",
  });
  yield* sql`INSERT INTO authority.worlds ${sql.insert({
    cell_epoch: "0",
    cell_id: randomUUID(),
    created_at: "2026-09-05T00:00:00.000Z",
    data_policy_id: "d01-local-retained-v1",
    emergency_deny: false,
    generation_id: randomUUID(),
    realm,
    release_digest: "a".repeat(64),
    security_revision: "0",
    world_id: worldId,
  })}`;
  yield* sql`INSERT INTO authority.memberships ${sql.insert({
    principal_id: principal,
    realm,
    revision: "0",
    role: "owner",
    state: "active",
    world_id: worldId,
  })}`;
  yield* sql`INSERT INTO authority.domains ${sql.insert({ domain_key: "claims", realm, version: "0", world_id: worldId })}`;
  yield* sql`INSERT INTO authority.receipts ${sql.insert({
    commit_id: randomUUID(),
    committed_at: "2026-09-05T00:00:00.000Z",
    operation: "CreatePersonalWorld",
    principal_id: principal,
    realm,
    receipt_id: receipt,
    result: yield* Schema.encodeEffect(
      Schema.fromJsonString(StoredOperationResult)
    )(result),
    touched_domains: yield* Schema.encodeEffect(
      Schema.fromJsonString(DomainCut)
    )(cut),
    world_id: worldId,
  })}`;
  for (const id of [source, otherSource]) {
    yield* sql`INSERT INTO authority.sources ${sql.insert({
      external_id: id,
      label: "SQL integrity fixture",
      namespace: "ex06",
      realm,
      source_id: id,
      world_id: worldId,
    })}`;
  }
  yield* sql`INSERT INTO jobs.captures ${sql.insert({
    byte_length: 1,
    capture_id: capture,
    expected_digest: "a".repeat(64),
    expires_at: "2026-09-05T01:00:00.000Z",
    fence: "0",
    object_location: null,
    principal_id: principal,
    realm,
    state: "reserved",
    world_id: worldId,
  })}`;
  yield* sql`INSERT INTO authority.evidence ${sql.insert({
    admitted_receipt_id: receipt,
    byte_digest: "a".repeat(64),
    capture_id: capture,
    evidence_id: evidence,
    realm,
    source_id: source,
    source_revision: "revision-1",
    state: "admitted",
    world_id: worldId,
  })}`;
  return {
    capture,
    evidence,
    otherSource,
    principal,
    realm,
    receipt,
    source,
    worldId,
  };
});

export const claimRow = (
  seed: Effect.Success<ReturnType<typeof seedEvidence>>
) => ({
  amount: "0",
  claim_id: randomUUID(),
  currency: "BRL",
  evidence_id: seed.evidence,
  external_id: randomUUID(),
  introduced_receipt_id: seed.receipt,
  predicate: "obligation.amount",
  realm: seed.realm,
  record_index: 0,
  source_id: seed.source,
  subject_key: "test-obligation",
  valid_from: "2026-01-01",
  valid_to: "2026-02-01",
  value_tag: "Known",
  world_id: seed.worldId,
});
