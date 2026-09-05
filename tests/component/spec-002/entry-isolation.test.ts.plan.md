# File plan — `tests/component/spec-002/entry-isolation.test.ts`

**Status:** implementation-in-progress; no product acceptance implied.

Target: `tests/component/spec-002/entry-isolation.test.ts`. Representation: **existing-with-sidecar**. Allocation: **required**.

Specs: [SPEC-002](../../../docs/specs/spec-002.md).
Tickets: [ZN-0018](../../../docs/tickets/zn-0018.md).

## Responsibility and reuse

The adjacent implementation is preserved. Read it first, extend it in place, and prove behavior at the ticket's required layer. Do not replace it with this plan or create a duplicate primitive.

```text
SUITE ZN-0018 [required layer=component; currently NOT IMPLEMENTED]
  REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
  USE synthetic input records, not synthetic services, fake credentials or canned provider responses.

  TEST ZN-0018-AC:
    ARRANGE Each non-authority role holds its intended credential only
    ACT It attempts forbidden SQL and the normal entry flow
    ASSERT Forbidden operations fail at the database or service boundary; legitimate entry still works; no broad superuser runtime exists
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  TEST ZN-0018-NEG:
    ARRANGE the same ticket component with the stated invalid/denied input.
    ACT only through its real supported boundary; inspect denial and lack of side effects.
    ASSERT Use revoked presence or the wrong principal/audience. No World grant, membership change or protected disclosure occurs. Exercise this against the component delivered by this ticket; do not require a later-stage feature to implement an early negative check.
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  TEST ZN-0018-BOUNDARY:
    ARRANGE the same component at its named failure/replay/resource boundary.
    ACT with independently controlled real connection/process barriers when I/O is involved.
    ASSERT For this operation, race duplicate delivery/replay and a relevant dependency change at a named commit boundary. At most one same-intent semantic result commits; stale work is rejected. For read-only/validation work, prove deterministic output at the same basis and explicit stale/unsupported output at the changed basis.
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.
  CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.
  NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
