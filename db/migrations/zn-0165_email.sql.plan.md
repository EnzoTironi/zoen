# File plan — `db/migrations/zn-0165_email.sql`

**Status:** planned; no product acceptance implied.

Target: `db/migrations/zn-0165_email.sql`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-028](../../docs/specs/spec-028.md).
Tickets: [ZN-0165](../../docs/tickets/zn-0165.md).

## Responsibility and reuse

```text
CONDITIONAL MIGRATION PLAN — never feed this Markdown to a migrator.
IF no durable invariant is introduced by the owning ticket: do not create a no-op SQL migration.
OTHERWISE acquire the global schema lock; inspect existing catalog and table owner before adding DDL.
DECLARE explicit types, primary/unique keys, World+realm composite foreign references and indexes.
SEPARATE migrator DDL from runtime roles; parameterize values and retain source/rights/retention lineage.
ORDER expand → backfill → validate → contract, with restartable bounded backfill.
TEST empty database, prior-schema upgrade, role denials, crash boundary and forward repair using real PostgreSQL.
ASSIGN final monotonic migration number only when the genuine SQL is reviewed; never pre-record a planned migration as applied.
```

## Owning state / operation contracts

### SPEC-028
AdmitTelegramWebhook(raw,verification) -> Ingress; AdmitEmailWebhook(raw,verification) -> Ingress; LinkChannel(principalProof,challenge) -> Binding; ContinueConversation(focus,newChannel) -> FreshAuthorizedTurn.

Reuse channels.ingress, bindings, consent and delivery with provider/account namespaces. Email message/thread headers and Telegram chat IDs are provider-scoped references, not authenticated principals. A relationship-channel link requires separate proof and consent.

[algorithm SPEC-028](../../docs/algorithms/spec-028.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
