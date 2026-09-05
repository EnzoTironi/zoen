# SPEC-011 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-011](../specs/spec-011.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Channels**. Module: `packages/adapters/src/channels/whatsapp`. Milestone: **S1**.

## Normative operation signatures

```text
AdmitWebhook(rawBytes,verifiedHeaders) -> DurableAck | Reject; BindChannel(proof,challenge) -> BindingReceipt; PrepareDelivery(messageRef,policyBasis) -> DeliveryIntent | Deferred | Denied; ObserveDelivery(providerEvidence) -> DeliveryObservation.
```

## State and transaction contract

channels.ingress(ingress_id PK,provider,account_ref,provider_event_id,received_at,signature_profile,payload_ref,UNIQUE(provider,account_ref,provider_event_id)); channels.bindings(binding_id PK,provider_subject,principal_ref_nullable,consent_ref,assurance,state); channels.delivery(delivery_id PK,message_ref,destination_ref,provider_message_id,state,attempt_ref); channels.consent(consent_id PK,subject_ref,purpose,granted_at,revoked_at,evidence_ref). Provider payload retention is explicit.

## Shared algorithm

```text
VERIFY exact admitted provider signature/replay contract on raw bytes before parsing; do not invent headers.
CHECK account namespace, payload limits and event identity; persist ingress and owned outbox before ACK.
DEDUPLICATE provider replay by stable event identity and dispatch one Eve turn after durable admission.
BIND channel to principal only via verified secure challenge and explicit consent; sender number is not a World grant.
CREATE authority-free continuation through SPEC-051; preview GET/HEAD is generic and consumes nothing.
BEFORE sending recheck audience, current disclosure, consent, provider template/window rules and enabled qualification.
PERSIST delivery intent then call the real provider outside authority transaction; observe actual accepted/delivered/unknown evidence.
ON lost acknowledgement reconcile known provider identity; never synthesize delivered status or blindly duplicate a consequential send.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0064](../tickets/zn-0064.md) | Admit signed webhooks before acknowledgement | [packages/adapters/src/channels/whatsapp/webhook.ts](../../packages/adapters/src/channels/whatsapp/webhook.ts) |
| [ZN-0065](../tickets/zn-0065.md) | Bind a channel without granting World access | [packages/adapters/src/channels/whatsapp/channel-binding.ts](../../packages/adapters/src/channels/whatsapp/channel-binding.ts) |
| [ZN-0066](../tickets/zn-0066.md) | Enforce message window, template and consent policy | [packages/adapters/src/channels/whatsapp/send-policy.ts](../../packages/adapters/src/channels/whatsapp/send-policy.ts) |
| [ZN-0067](../tickets/zn-0067.md) | Track message delivery ambiguity independently | [packages/adapters/src/channels/whatsapp/delivery.ts](../../packages/adapters/src/channels/whatsapp/delivery.ts) |
| [ZN-0068](../tickets/zn-0068.md) | Implement secure continuation and attachment handoff | [packages/adapters/src/channels/whatsapp/continuation.ts](../../packages/adapters/src/channels/whatsapp/continuation.ts) |
| [ZN-0069](../tickets/zn-0069.md) | Qualify real WhatsApp transport and current operating terms | [admissions/spec-011/whatsapp-qualification.json](../../admissions/spec-011/whatsapp-qualification.json.plan.md) |

## Required proof boundaries

Use the actual documented signature/replay scheme of the admitted API version; do not invent a common HMAC header. Validate raw bytes before parsing. Persist ingress and owner outbox before ACK. Link channel identity through a fresh secure challenge. Evaluate consent/template/window and audience before each send. Tokens in continuation links are opaque, short-lived and single-use for linking, not transferable World access.

V4 refinement: ZN-0068 consumes the reusable authority-free continuation registry and browser exchange in SPEC-051. A URL, WhatsApp delivery receipt or sender number cannot confer World access. Preview GET/HEAD is generic and never redeems a challenge.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
