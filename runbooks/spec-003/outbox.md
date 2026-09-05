# Outbox lease and consumer handoff repair — ZN-0023

**Status:** implementation-in-progress; deployments not yet qualified. Ticket unaccepted.

Scope: fenced outbox leases and idempotent consumer handoff.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE jobs.outbox (state, lease_owner, fence, lease_until), jobs.consumer_admissions, jobs.consumer_cursors.
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under ClaimOutbox → admitConsumer (dedup) → ProgressCommit / acknowledge:
  - Successor takeover: expire/steal lease with fence+1; re-admit is idempotent (firstAdmission=false).
  - Zombie fence: LostLease on progress/ack; no delivered mutation.
  - Owner-specific cursors: jobs.consumer_cursors keyed by stream_owner only.
VERIFY ZN-0023-AC/NEG/BOUNDARY on real PostgreSQL with disposable namespace.
RESUME only with current approval and intact unrelated tenant scopes.
```

## Operations

- `ClaimOutbox(owner,limit) -> FencedBatch`
- `admitConsumer(lease,consumer) -> ConsumerAdmitResult` (dedup before ack)
- `ProgressCommit(leaseToken,progress) -> Progress | LostLease`
- `acknowledge(lease) -> void | LostLease`

## Acceptance boundary

Services are not mocked. Missing credentials/dependencies remain blockers. Do not mark accepted without independent review.
