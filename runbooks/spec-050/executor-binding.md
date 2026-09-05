# ZN-0291 — executor binding repair

**Status:** implementation-in-progress; not accepted.

Scope: Bind every structured ingress to the existing semantic dispatcher (SPEC-050 / SPEC-007).

## Precheck

- Exact environment/profile and operator authority
- Ticket evidence for ZN-0291 AC/NEG/BOUNDARY
- Affected World/realm

## Observe

Web and CLI issue the same Inspect under equal verified context and pinned basis. Both must enter `packages/ontology/src/surfaces/dispatch.ts` via `BoundSemanticClient` and return the same authorized interpretation, rival references, basis and result tag. No model invocation.

## Repair

1. Normalize transport into the common envelope; identity only from verified server bindings.
2. Resolve via SPEC-007 `SemanticDispatcher` — never a second executor.
3. Preserve intent ID, contract digest, basis and purpose on retry; a new ID is a new intention.
4. Reject client-supplied principal, raw SQL and source URL before repository access.
5. Production logs: opaque IDs and digests only (`opaqueEntryDigest`).

## Verify

Re-run `ZN-0291-AC`, `ZN-0291-NEG`, `ZN-0291-BOUNDARY` on real Postgres. Do not mark accepted without independent review.
