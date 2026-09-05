# SPEC-028 — Telegram, email and cross-channel continuity

**Milestone:** S5 · **Owner:** Channels · **Root:** `packages/adapters/src/channels/multichannel`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Channel adapters implement a shared ingress/delivery contract but retain provider-specific verification and ambiguity behavior. Switching channels changes transport, not permissions, World meaning or the identity ceremony.

## Owned state and storage contract
Reuse channels.ingress, bindings, consent and delivery with provider/account namespaces. Email message/thread headers and Telegram chat IDs are provider-scoped references, not authenticated principals. A relationship-channel link requires separate proof and consent.

## Operations

```text
AdmitTelegramWebhook(raw,verification) -> Ingress; AdmitEmailWebhook(raw,verification) -> Ingress; LinkChannel(principalProof,challenge) -> Binding; ContinueConversation(focus,newChannel) -> FreshAuthorizedTurn.
```

## Execution protocol
Use actual provider verification; Telegram webhook secret and email event signatures are not interchangeable. Email From is not proof of person identity. Reject reply-to/header injection and bound attachments. Link/rebind through secure authentication. Channel recipient changes trigger fresh audience disclosure. Delivery observations remain accepted/delivered/read/unknown according to actual provider evidence.

## Pseudocode and file ownership

[algorithm SPEC-028](../algorithms/spec-028.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0164](../tickets/zn-0164.md) | Implement Telegram ingress and delivery adapter | component | [ZN-0068](../tickets/zn-0068.md), [ZN-0111](../tickets/zn-0111.md), [ZN-0158](../tickets/zn-0158.md) |
| [ZN-0165](../tickets/zn-0165.md) | Implement email ingress, threading and attachment safety | component | [ZN-0164](../tickets/zn-0164.md) |
| [ZN-0166](../tickets/zn-0166.md) | Continue one relationship across independently linked channels | component | [ZN-0165](../tickets/zn-0165.md) |
| [ZN-0167](../tickets/zn-0167.md) | Normalize provider capabilities without false delivery guarantees | component | [ZN-0166](../tickets/zn-0166.md) |
| [ZN-0168](../tickets/zn-0168.md) | Qualify actual Telegram and email account journeys | admission | [ZN-0167](../tickets/zn-0167.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `messaging-channels.md`, `release-policy-eve.md`. Read a named historical reference only when needed; it cannot override current contracts.
