# packages/adapters/src/channels/multichannel

**Module boundary — not a service per spec.** Existing source and comment-only plans are distinct.

## Owned contracts

- [SPEC-028](../../../../../docs/specs/spec-028.md) — Telegram, email and cross-channel continuity; [algorithm SPEC-028](../../../../../docs/algorithms/spec-028.md)

## Local file map

| Target | Role | Plan |
|---|---|---|
| `channel-capabilities.ts` | required | [read](channel-capabilities.ts) |
| `channel-continuity.ts` | required | [read](channel-continuity.ts) |
| `email.ts` | required | [read](email.ts) |
| `index.ts` | conditional-support | [read](index.ts) |
| `ports.ts` | conditional-support | [read](ports.ts) |
| `telegram.ts` | required | [read](telegram.ts) |
| `types.ts` | conditional-support | [read](types.ts) |

Shared invariants and dependencies: [repository contract](../../../../../docs/architecture/repository-contract.md). Do not add another data/authorization path.
