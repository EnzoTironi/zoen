// @zoen-plan packages/ontology/src/datasets/dataset-publish.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `packages/ontology/src/datasets/dataset-publish.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `packages/ontology/src/datasets/dataset-publish.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-031](../../../../docs/specs/spec-031.md).
// Tickets: [ZN-0183](../../../../docs/tickets/zn-0183.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0183 /* planning label, not a public API */
//   OWNER := SPEC-031; TARGET := packages/ontology/src/datasets/dataset-publish.ts
//   REQUIRE accepted dependencies: ZN-0182
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     READ exact input versions and current source/license rights; allocate a non-authoritative staging run.
//     WRITE immutable Parquet/Iceberg data and catalog metadata under admitted schema/profile with deterministic run identity.
//     VALIDATE schema, counts/quality, lineage, exact snapshot and retention pins before readiness.
//     RECHECK expected authority basis and publication policy; staging/catalog latest is never public authority.
//     ATOMically publish a DatasetVersion reference and receipt in Ontology; readers resolve only published exact versions.
//     EXECUTE dense reads outside long SQL transactions using pinned snapshots and bounded resources.
//     REAUTHORIZE chunk delivery and derived output labels; fail when a pinned version is unavailable.
//     GARbage-collect only after active publication, frame, evaluation, legal hold and retention references allow deletion.
//   TICKET-SPECIFIC SEGMENT:
//     01. Use AuthorityCommit to admit exact version refs, derived changes and outbox.
//     02. Bind expected input cuts/quality/rights and idempotency intent.
//     03. Retry bookkeeping without replacing snapshot identities.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN Two related datasets are staged and the process crashes around their publication
//     WHEN The same operation retries
//     THEN Both versions become authoritative together or neither does; catalog latest is not consulted to guess the result
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
