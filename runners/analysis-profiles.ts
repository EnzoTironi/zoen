// @zoen-plan runners/analysis-profiles.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `runners/analysis-profiles.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `runners/analysis-profiles.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-030](../docs/specs/spec-030.md).
// Tickets: [ZN-0177](../docs/tickets/zn-0177.md).
//
// ## Responsibility and reuse
//
// ```text
// PROCEDURE ZN_0177 /* planning label, not a public API */
//   OWNER := SPEC-030; TARGET := runners/analysis-profiles.ts
//   REQUIRE accepted dependencies: ZN-0176
//   REQUIRE evidence layer: component; actual admitted services when needed
//   IF a required service/profile/schema is missing: STOP Blocked; never substitute a provider.
//   IF normative contracts conflict: STOP SpecConflict; never choose a permissive interpretation.
//   USE the shared module protocol below; implement ONLY this ticket's segment, not a duplicate engine.
//     ACQUIRE lease bound to World/realm/principal/purpose/artifact/input cut/budget/epoch and admitted host profile.
//     START outside authority process in actual qualified containment with default-deny network and no ambient credentials.
//     DENY host files, container socket, metadata endpoints and authority/source secrets; enforce limits outside guest process.
//     FOR an app request expose only released semantic calls through the common executor; no generic URL/SQL/provider proxy.
//     FOR separately admitted acquisition/effect lanes validate capability, destination, DNS/redirect chain, body and lease on every use.
//     SUPPLY immutable read inputs for analysis, record nondeterminism/seed/environment and output lineage.
//     VALIDATE bounded outputs and current rights before admission; publishing is a separate governed operation.
//     ON expiry/revocation/resource violation stop fenced execution, retain real unknown effects and cleanup only unpinned artifacts.
//   TICKET-SPECIFIC SEGMENT:
//     01. Mount only immutable leased inputs and output staging areas.
//     02. Record exact runtime/library lock, source code, seed and declared nondeterminism.
//     03. Return an AnalysisArtifact with lineage; do not write facts or call Actions directly.
//   TEST BEFORE DECLARING THIS SEGMENT COMPLETE:
//     GIVEN A notebook computes a forecast and attempts direct database write/network access
//     WHEN The analysis runner executes it
//     THEN The forecast is a read-only attributed artifact; unauthorized writes/network fail and no prediction becomes a fact automatically
//   ON failure: preserve observed state and evidence; no fabricated success or consent refresh.
//   RETURN only the owning spec's tagged result / recorded test evidence for the exact ticket.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
