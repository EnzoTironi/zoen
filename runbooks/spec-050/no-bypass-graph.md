# ZN-0292 — no-bypass graph repair

**Status:** implementation-in-progress; not accepted.

Scope: Enforce client-to-data import and credential boundaries (static).

## Precheck

- Fixture seed `zn-0292-no-bypass-seed-v1`
- Declared client roots vs trusted composition roots

## Observe

A mini-app or Eve module importing raw `pg` (or a barrel/alias/dynamic import) must fail the static gate. Ordinary `SemanticClient` imports remain valid. An empty or disconnected checker must Reject, never certify.

## Repair

1. Move data-plane imports into trusted composition (`authority-worker` / ontology / adapters).
2. Clients call only `SemanticClientPort` / transport SemanticClient.
3. Update `.dependency-cruiser.cjs` when adding a reviewed edge — never widen silently.
4. Re-run `ZN-0292-AC` / `NEG` / `BOUNDARY`.

Do not mark accepted without independent review.
