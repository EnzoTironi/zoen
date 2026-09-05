# File plan — `tests/component/spec-000/test-harness.test.ts`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `tests/component/spec-000/test-harness.test.ts`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-000](../../../docs/specs/spec-000.md).
Tickets: [ZN-0004](../../../docs/tickets/zn-0004.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
SUITE ZN-0004 [required layer=component; currently NOT IMPLEMENTED]
  REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
  USE synthetic input records, not synthetic services, fake credentials or canned provider responses.

  TEST ZN-0004-AC:
    ARRANGE A test requests an unconfigured real PostgreSQL profile
    ACT verify:ticket resolves the profile and test selectors
    ASSERT The command fails as missing-prerequisite rather than skipping; an admitted profile runs nonzero tests and records seed, logs and dependency versions
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  TEST ZN-0004-NEG:
    ARRANGE the same ticket component with the stated invalid/denied input.
    ACT only through its real supported boundary; inspect denial and lack of side effects.
    ASSERT Remove a required tool, secret reference or test dependency. The harness fails as missing prerequisite and cannot pass by skipping. Exercise this against the component delivered by this ticket; do not require a later-stage feature to implement an early negative check.
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  TEST ZN-0004-BOUNDARY:
    ARRANGE the same component at its named failure/replay/resource boundary.
    ACT with independently controlled real connection/process barriers when I/O is involved.
    ASSERT Repeat with duplicate/reordered input, revoked access and the profile limit at the task boundary. Preserve the declared oracle; report unsupported/incomplete state rather than silent truncation, disclosure or fabricated success.
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.
  CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.
  NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
