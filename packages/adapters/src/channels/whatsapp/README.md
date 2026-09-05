# packages/adapters/src/channels/whatsapp

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-011](../../../../../docs/specs/spec-011.md) — WhatsApp durable ingress, consent and secure continuation; [algorithm SPEC-011](../../../../../docs/algorithms/spec-011.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `channel-binding.ts` | required | [read](channel-binding.ts) |
| `continuation.ts` | required | [read](continuation.ts) |
| `delivery.ts` | required | [read](delivery.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `send-policy.ts` | required | [read](send-policy.ts) |
| `types.ts` | conditional-support | [read](types.ts) |
| `webhook.ts` | required | [read](webhook.ts) |

Shared invariants and dependencies: [repository contract](../../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
