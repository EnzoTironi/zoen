# Runbook — bounded canonical parsing and hashing (ZN-0010)

**Status:** implementation-in-progress; not accepted. Law-layer only.

## Scope

Authority JSON parse with 1 MiB / depth 32 / 10_000 entry limits, duplicate-key rejection, RFC 8785-subset canonicalization, SHA-256 digests, and `parseEnvelope`.

## Observe

1. Duplicate keys => `JSON_DUPLICATE_KEY` (never last-write-wins).
2. Equivalent objects with different insertion order share one digest.
3. Remote `$ref` / `$schema` / `$id` with URI scheme => `JSON_REMOTE_REFERENCE`.

## Repair

```sh
node --experimental-strip-types --test tests/law/spec-001/canonical.test.ts
```

Do not fabricate digests. Ticket remains unaccepted until independent review.
