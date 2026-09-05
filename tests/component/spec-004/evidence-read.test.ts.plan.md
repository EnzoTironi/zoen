// @zoen-plan tests/component/spec-004/evidence-read.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/component/spec-004/evidence-read.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/component/spec-004/evidence-read.test.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-004](../../../docs/specs/spec-004.md).
// Tickets: [ZN-0027](../../../docs/tickets/zn-0027.md).
//
// ## Responsibility and reuse
//
// ```text
// SUITE ZN-0027 [required layer=component; currently NOT IMPLEMENTED]
//   REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
//   USE synthetic input records, not synthetic services, fake credentials or canned provider responses.
//
//   TEST ZN-0027-AC:
//     ARRANGE An old evidence bookmark after grant revocation or retention expiry
//     ACT The holder tries to read the bytes
//     ASSERT No bytes or storage locator are disclosed; the authorized case gets the correct expired/unavailable explanation
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0027-NEG:
//     ARRANGE the same ticket component with the stated invalid/denied input.
//     ACT only through its real supported boundary; inspect denial and lack of side effects.
//     ASSERT Use a wrong-World ref, missing durable bytes or expired rights. No evidence is admitted or disclosed. Exercise this against the component delivered by this ticket; do not require a later-stage feature to implement an early negative check.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0027-BOUNDARY:
//     ARRANGE the same component at its named failure/replay/resource boundary.
//     ACT with independently controlled real connection/process barriers when I/O is involved.
//     ASSERT For this operation, race duplicate delivery/replay and a relevant dependency change at a named commit boundary. At most one same-intent semantic result commits; stale work is rejected. For read-only/validation work, prove deterministic output at the same basis and explicit stale/unsupported output at the changed basis.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   AVAILABLE SPEC-LOCAL FAULT BOUNDARIES (apply only when owned by this ticket):
//     F-04: barrier=after object durable, before evidence commit; inject=Kill process; race cleanup; assert=Orphan collectible only without pending/pin; no missing admitted bytes.
//
//   ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.
//   CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.
//   NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
