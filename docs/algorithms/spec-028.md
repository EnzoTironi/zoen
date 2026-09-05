# SPEC-028 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-028](../specs/spec-028.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Channels**. Module: `packages/adapters/src/channels/multichannel`. Milestone: **S5**.

## Normative operation signatures

```text
AdmitTelegramWebhook(raw,verification) -> Ingress; AdmitEmailWebhook(raw,verification) -> Ingress; LinkChannel(principalProof,challenge) -> Binding; ContinueConversation(focus,newChannel) -> FreshAuthorizedTurn.
```

## State and transaction contract

Reuse channels.ingress, bindings, consent and delivery with provider/account namespaces. Email message/thread headers and Telegram chat IDs are provider-scoped references, not authenticated principals. A relationship-channel link requires separate proof and consent.

## Shared algorithm

```text
VERIFY each provider's actual supported webhook scheme, raw bytes and account namespace.
PERSIST stable ingress and owned outbox before acknowledgement using shared channel durability patterns.
TREAT email headers/chat IDs as provider references, not identity proof; reject header/address injection.
BOUND attachments and admit bytes through quarantine/evidence machinery.
LINK/rebind identity via fresh challenge and explicit consent; changed recipient triggers new audience check.
REOPEN Focus through the same semantic client; carry no prior channel credentials into World authority.
PREPARE delivery under current policy and actual provider profile; retain accepted/delivered/read/unknown as observed.
QUALIFY real provider accounts; no invented email/Telegram endpoints or offline delivery substitute.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0164](../tickets/zn-0164.md) | Implement Telegram ingress and delivery adapter | [packages/adapters/src/channels/multichannel/telegram.ts](../../packages/adapters/src/channels/multichannel/telegram.ts) |
| [ZN-0165](../tickets/zn-0165.md) | Implement email ingress, threading and attachment safety | [packages/adapters/src/channels/multichannel/email.ts](../../packages/adapters/src/channels/multichannel/email.ts) |
| [ZN-0166](../tickets/zn-0166.md) | Continue one relationship across independently linked channels | [packages/adapters/src/channels/multichannel/channel-continuity.ts](../../packages/adapters/src/channels/multichannel/channel-continuity.ts) |
| [ZN-0167](../tickets/zn-0167.md) | Normalize provider capabilities without false delivery guarantees | [packages/adapters/src/channels/multichannel/channel-capabilities.ts](../../packages/adapters/src/channels/multichannel/channel-capabilities.ts) |
| [ZN-0168](../tickets/zn-0168.md) | Qualify actual Telegram and email account journeys | [admissions/spec-028/channel-qualification.json](../../admissions/spec-028/channel-qualification.json.plan.md) |

## Required proof boundaries

Use actual provider verification; Telegram webhook secret and email event signatures are not interchangeable. Email From is not proof of person identity. Reject reply-to/header injection and bound attachments. Link/rebind through secure authentication. Channel recipient changes trigger fresh audience disclosure. Delivery observations remain accepted/delivered/read/unknown according to actual provider evidence.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
