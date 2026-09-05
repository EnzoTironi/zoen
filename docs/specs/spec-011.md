# SPEC-011 — WhatsApp durable ingress, consent and secure continuation

**Milestone:** S1 · **Owner:** Channels · **Root:** `packages/adapters/src/channels/whatsapp`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Kapso is the selected WhatsApp route, subject to current provider/platform admission. Transport identity is not authority. Webhooks are acknowledged only after durable local ingress. Channel policy and delivery ambiguity are first-class states.

## Owned state and storage contract
channels.ingress(ingress_id PK,provider,account_ref,provider_event_id,received_at,signature_profile,payload_ref,UNIQUE(provider,account_ref,provider_event_id)); channels.bindings(binding_id PK,provider_subject,principal_ref_nullable,consent_ref,assurance,state); channels.delivery(delivery_id PK,message_ref,destination_ref,provider_message_id,state,attempt_ref); channels.consent(consent_id PK,subject_ref,purpose,granted_at,revoked_at,evidence_ref). Provider payload retention is explicit.

## Operations

```text
AdmitWebhook(rawBytes,verifiedHeaders) -> DurableAck | Reject; BindChannel(proof,challenge) -> BindingReceipt; PrepareDelivery(messageRef,policyBasis) -> DeliveryIntent | Deferred | Denied; ObserveDelivery(providerEvidence) -> DeliveryObservation.
```

## Execution protocol
Use the actual documented signature/replay scheme of the admitted API version; do not invent a common HMAC header. Validate raw bytes before parsing. Persist ingress and owner outbox before ACK. Link channel identity through a fresh secure challenge. Evaluate consent/template/window and audience before each send. Tokens in continuation links are opaque, short-lived and single-use for linking, not transferable World access.

V4 refinement: ZN-0068 consumes the reusable authority-free continuation registry and browser exchange in SPEC-051. A URL, WhatsApp delivery receipt or sender number cannot confer World access. Preview GET/HEAD is generic and never redeems a challenge.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-011](../algorithms/spec-011.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0064](../tickets/zn-0064.md) | Admit signed webhooks before acknowledgement | component | [ZN-0057](../tickets/zn-0057.md), [ZN-0062](../tickets/zn-0062.md) |
| [ZN-0065](../tickets/zn-0065.md) | Bind a channel without granting World access | component | [ZN-0064](../tickets/zn-0064.md) |
| [ZN-0066](../tickets/zn-0066.md) | Enforce message window, template and consent policy | component | [ZN-0065](../tickets/zn-0065.md) |
| [ZN-0067](../tickets/zn-0067.md) | Track message delivery ambiguity independently | component | [ZN-0066](../tickets/zn-0066.md) |
| [ZN-0068](../tickets/zn-0068.md) | Implement secure continuation and attachment handoff | component | [ZN-0067](../tickets/zn-0067.md), [ZN-0297](../tickets/zn-0297.md) |
| [ZN-0069](../tickets/zn-0069.md) | Qualify real WhatsApp transport and current operating terms | admission | [ZN-0068](../tickets/zn-0068.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `messaging-channels.md`, `rights-and-access-control.md`. Read a named historical reference only when needed; it cannot override current contracts.
