// @zoen-plan tests/component/spec-031/dense-profile.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/component/spec-031/dense-profile.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/component/spec-031/dense-profile.test.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-031](../../../docs/specs/spec-031.md).
// Tickets: [ZN-0180](../../../docs/tickets/zn-0180.md).
//
// ## Responsibility and reuse
//
// ```text
// SUITE ZN-0180 [required layer=component; currently NOT IMPLEMENTED]
//   REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
//   USE synthetic input records, not synthetic services, fake credentials or canned provider responses.
//
//   TEST ZN-0180-AC:
//     ARRANGE An Iceberg table uses an unsupported delete mode or unsafe integer snapshot conversion
//     ACT Compatibility qualification runs
//     ASSERT The profile rejects it explicitly; snapshot IDs round-trip as strings and no silent row omission is accepted
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0180-NEG:
//     ARRANGE the same ticket component with the stated invalid/denied input.
//     ACT only through its real supported boundary; inspect denial and lack of side effects.
//     ASSERT Publish an unsupported format or unpinned snapshot, or use catalog latest for historical reads. Reject rather than silently reinterpret. Exercise this against the component delivered by this ticket; do not require a later-stage feature to implement an early negative check.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0180-BOUNDARY:
//     ARRANGE the same component at its named failure/replay/resource boundary.
//     ACT with independently controlled real connection/process barriers when I/O is involved.
//     ASSERT For this operation, race duplicate delivery/replay and a relevant dependency change at a named commit boundary. At most one same-intent semantic result commits; stale work is rejected. For read-only/validation work, prove deterministic output at the same basis and explicit stale/unsupported output at the changed basis.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   AVAILABLE SPEC-LOCAL FAULT BOUNDARIES (apply only when owned by this ticket):
//     F-13: barrier=after pin before PG publication; inject=Catalog GC and process kill; assert=No published missing snapshot; no mixed version set.
//
//   ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.
//   CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.
//   NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
