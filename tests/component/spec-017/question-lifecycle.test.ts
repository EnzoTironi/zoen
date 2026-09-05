// @zoen-plan tests/component/spec-017/question-lifecycle.test.ts
// NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
// # File plan — `tests/component/spec-017/question-lifecycle.test.ts`
//
// **Status:** planned; no product acceptance implied.
//
// Target: `tests/component/spec-017/question-lifecycle.test.ts`. Representation: **comment-only-source**. Allocation: **required**.
//
// Specs: [SPEC-017](../../../docs/specs/spec-017.md).
// Tickets: [ZN-0104](../../../docs/tickets/zn-0104.md).
//
// ## Responsibility and reuse
//
// ```text
// SUITE ZN-0104 [required layer=component; currently NOT IMPLEMENTED]
//   REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
//   USE synthetic input records, not synthetic services, fake credentials or canned provider responses.
//
//   TEST ZN-0104-AC:
//     ARRANGE A queued quantity question becomes obsolete after a signed amendment arrives
//     ACT The user answers the old message
//     ASSERT The answer is rejected as stale and no obsolete claim selection occurs; unknown responses do not boost either candidate
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0104-NEG:
//     ARRANGE the same ticket component with the stated invalid/denied input.
//     ACT only through its real supported boundary; inspect denial and lack of side effects.
//     ASSERT Submit an answer for the wrong question digest/kind/scope. No local or reusable knowledge changes. Exercise this against the component delivered by this ticket; do not require a later-stage feature to implement an early negative check.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   TEST ZN-0104-BOUNDARY:
//     ARRANGE the same component at its named failure/replay/resource boundary.
//     ACT with independently controlled real connection/process barriers when I/O is involved.
//     ASSERT For this operation, race duplicate delivery/replay and a relevant dependency change at a named commit boundary. At most one same-intent semantic result commits; stale work is rejected. For read-only/validation work, prove deterministic output at the same basis and explicit stale/unsupported output at the changed basis.
//     CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.
//
//   AVAILABLE SPEC-LOCAL FAULT BOUNDARIES (apply only when owned by this ticket):
//     F-23: barrier=after wrong scoped reply then undo; inject=Replay prior question and correction IDs; assert=History preserved, no global rule installation.
//
//   ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.
//   CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.
//   NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.
// ```
//
// ## Acceptance boundary
//
// A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
