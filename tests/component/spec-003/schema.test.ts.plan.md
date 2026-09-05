@zoen-plan tests/component/spec-003/schema.test.ts
NON-EXECUTABLE PSEUDOCODE; not registered or compiled as product implementation.
# File plan — `tests/component/spec-003/schema.test.ts`

**Status:** planned; no product acceptance implied.

Target: `tests/component/spec-003/schema.test.ts`. Representation: **comment-only-source**. Allocation: **required**.

Specs: [SPEC-003](../../../docs/specs/spec-003.md).
Tickets: [ZN-0019](../../../docs/tickets/zn-0019.md).

## Responsibility and reuse

```text
SUITE ZN-0019 [required layer=component; currently NOT IMPLEMENTED]
  REQUIRE real admitted dependencies and disposable owned namespaces; missing dependency => BLOCKED.
  USE synthetic input records, not synthetic services, fake credentials or canned provider responses.

  TEST ZN-0019-AC:
    ARRANGE A fresh database and a populated prior-version fixture
    ACT Migrations apply, fail midway and resume
    ASSERT Both paths produce the expected schema without duplicate history; runtime roles cannot execute DDL or progress-write authority rows
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  TEST ZN-0019-NEG:
    ARRANGE the same ticket component with the stated invalid/denied input.
    ACT only through its real supported boundary; inspect denial and lack of side effects.
    ASSERT Use a stale head/domain/epoch/fence or changed intent. No partial receipt, mutation or outbox progress commits. Exercise this against the component delivered by this ticket; do not require a later-stage feature to implement an early negative check.
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  TEST ZN-0019-BOUNDARY:
    ARRANGE the same component at its named failure/replay/resource boundary.
    ACT with independently controlled real connection/process barriers when I/O is involved.
    ASSERT For this operation, race duplicate delivery/replay and a relevant dependency change at a named commit boundary. At most one same-intent semantic result commits; stale work is rejected. For read-only/validation work, prove deterministic output at the same basis and explicit stale/unsupported output at the changed basis.
    CAPTURE commit, actual profile/lock, fixture seed, executed count and raw observations.

  AVAILABLE SPEC-LOCAL FAULT BOUNDARIES (apply only when owned by this ticket):
    F-01: barrier=after guard check, before SQL commit; inject=SIGKILL real authority process; assert=No partial semantic state/receipt/outbox.
    F-02: barrier=after commit, before client reply; inject=Drop connection; retry same and changed intent; assert=Same receipt once; changed intent conflict; replay rights renewed.
    F-03: barrier=after approval, before new matching insert; inject=Race real serializable connections; assert=Stale Case despite unchanged visible row versions.

  ASSERT every required check executed, no required skips, nonzero count and exact semantic oracle.
  CLEANUP only this test namespace after checking receipts/pins/unknown external outcomes.
  NEVER expose clocks, barriers, fixture seeders or failure controls in production routes.
```

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
