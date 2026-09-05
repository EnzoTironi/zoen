// @zoen-plan tests/component/spec-021/clinic-availability.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/component/spec-021/clinic-availability.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/component/spec-021/clinic-availability.test.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-021](../../../docs/specs/spec-021.md).
// Tickets: [ZN-0125](../../../docs/tickets/zn-0125.md).
//
// ## Responsibility and reuse
//
// ```text
// SUITE ZN-0125 [required layer=component; currently NOT IMPLEMENTED]
//   REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
//   USE synthetic input records, not synthetic services, fake credentials or canned provider responses.
//
//   TEST ZN-0125-AC:
//     ARRANGE An appointment calendar is incomplete for one provider
//     ACT The user asks for available slots
//     ASSERT The answer distinguishes known availability from unknown coverage and does not promise an unverified slot
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0125-NEG:
//     ARRANGE the same ticket component with the stated invalid/denied input.
//     ACT only through its real supported boundary; inspect denial and lack of side effects.
//     ASSERT Give a receptionist a clinical or ambiguous-patient query. Clinical content/existence stays hidden and identity is not guessed. Exercise this against the component delivered by this ticket; do not require a later-stage feature to implement an early negative check.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0125-BOUNDARY:
//     ARRANGE the same component at its named failure/replay/resource boundary.
//     ACT with independently controlled real connection/process barriers when I/O is involved.
//     ASSERT For this operation, race duplicate delivery/replay and a relevant dependency change at a named commit boundary. At most one same-intent semantic result commits; stale work is rejected. For read-only/validation work, prove deterministic output at the same basis and explicit stale/unsupported output at the changed basis.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.
//   CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.
//   NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
