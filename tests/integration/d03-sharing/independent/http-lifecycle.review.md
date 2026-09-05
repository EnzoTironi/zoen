# Independent SH05 — two-process membership lifecycle

Production runtime: the existing reviewer-owned compiled `c60eff8` server used
by `http-process.ts`. No runtime was rebuilt or production source changed.
This adds two public HTTP cases without rerunning the twelve disclosure-order
cases. The server process launcher is reused unchanged; fixture setup remains
local to this sibling test so it does not import or register the twelve cases.

Each case starts two different OS processes and TCP origins with the same real
isolated PostgreSQL database, versioned S3 bucket, installation, policy and
identity secret. Signup, World creation, grants, revoke, replay and access
inspection use public HTTP. SQL only observes semantic state and temporarily
holds existing production operation advisory locks for scheduling; it does not
insert memberships, receipts, sessions or other semantic data.

Before sending either grant, an independent transaction holds the exact
operation advisory key or keys that `commitMutation` acquires. Both HTTP
requests are launched, one per server. The observer waits for two distinct
PostgreSQL backend PIDs with ungranted exclusive advisory locks on those exact
keys. Thus both real server transactions are concurrently inside commit, rather
than merely two client promises started near one another. It confirms absence
and unchanged receipt/outbox/domain counts, releases its transaction and lets
the real executor and PostgreSQL resolve contention. No driver observer is armed
and no SQL or provider response is replaced.

| Case | Executed result |
| --- | --- |
| Identical Grant intention and operationId in both processes | Both return HTTP 200 with byte-identical JSON and the same receipt; exactly one viewer membership at revision 0, one operation, one grant receipt, one matching outbox row and one membership-domain increment. |
| Distinct operationIds, same absent target and expectedRevision null | Exactly one HTTP 200 and one HTTP 409 with exact `{_tag:"Stale",code:"STALE"}`. The only persisted operation ID and grant receipt belong to the winner. Membership, receipt, outbox and domain deltas are each exactly one; no loser receipt persists. |
| Historical replay after confirmed revoke, in both cases | Public revoke returns HTTP 200 with revoked revision 1. Each server then replays the original winning grant byte-identically. All SQL counts and domain version remain unchanged; persisted membership stays revoked revision 1 and public InspectWorldAccess agrees. |

Fresh World baseline is 0 target memberships, 0 operations, 1 genesis receipt,
1 outbox and membership domain 0. Grant yields 1/1/2/2/1; revoke yields 1/2/3/3/2.
These baselines account explicitly for genesis and distinguish a duplicate
receipt from a second actual membership mutation.

## Execution and preserved harness failures

The first run failed both cases at server readiness because this new fixture
omitted enabling bucket versioning, which real server admission requires. No
SH05 assertion ran. The fixture now enables real versioning with the same SDK
command used in the established disclosure harness; admission was not bypassed.

A subsequent lint autofix incorrectly removed an explicit undefined argument
from `Deferred.succeed`, selecting its curried overload. That development run
was interrupted without a SH05 result. The scheduling signals now carry explicit
null values and typecheck passes. Neither failure changed expected product
results or product code.

The corrected harness passed 2/2, then after lint-equivalent traversal cleanup
the final file passed **2/2 on 2026-09-05: 3.35 seconds total, 2.91 seconds test
time**. Whole-worktree TypeScript checking, focused lint and diff whitespace
checking passed.

```text
node --env-file=.env.infra node_modules/vitest/vitest.mjs run --project integration tests/integration/d03-sharing/independent/http-lifecycle.review.integration.test.ts --maxWorkers=1
node node_modules/typescript/bin/tsc --noEmit
node node_modules/oxlint/bin/oxlint tests/integration/d03-sharing/independent/http-lifecycle.review.integration.test.ts
```

This is evidence for the specified SH05 process-concurrency gap. It does not
claim all sharing lifecycle permutations, erasure/restore, admission of a new
profile or complete D03 acceptance. Final integration and acceptance belong to
the independent root review.
