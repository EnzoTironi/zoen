# File plan — `runbooks/spec-028/channel-capabilities.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-028/channel-capabilities.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-028](../../docs/specs/spec-028.md).
Tickets: [ZN-0167](../../docs/tickets/zn-0167.md).

## Responsibility and reuse

## ZN-0167 operational/repair procedure

Scope: Normalize provider capabilities without false delivery guarantees. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Eve delivers a rich response
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
VERIFY each provider's actual supported webhook scheme, raw bytes and account namespace.
PERSIST stable ingress and owned outbox before acknowledgement using shared channel durability patterns.
TREAT email headers/chat IDs as provider references, not identity proof; reject header/address injection.
BOUND attachments and admit bytes through quarantine/evidence machinery.
LINK/rebind identity via fresh challenge and explicit consent; changed recipient triggers new audience check.
REOPEN Focus through the same semantic client; carry no prior channel credentials into World authority.
PREPARE delivery under current policy and actual provider profile; retain accepted/delivered/read/unknown as observed.
QUALIFY real provider accounts; no invented email/Telegram endpoints or offline delivery substitute.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
It provides the same authorized text/evidence meaning and never claims unsupported delivered/read states
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-028
AdmitTelegramWebhook(raw,verification) -> Ingress; AdmitEmailWebhook(raw,verification) -> Ingress; LinkChannel(principalProof,challenge) -> Binding; ContinueConversation(focus,newChannel) -> FreshAuthorizedTurn.

Reuse channels.ingress, bindings, consent and delivery with provider/account namespaces. Email message/thread headers and Telegram chat IDs are provider-scoped references, not authenticated principals. A relationship-channel link requires separate proof and consent.

[algorithm SPEC-028](../../docs/algorithms/spec-028.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
