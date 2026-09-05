# ADR-062 — One semantic execution path

Status: accepted design amendment for v4; implementation/qualification pending. Date: 2026-09-04.

## Decision

All surfaces execute the same SPEC-007 dispatcher and current authorization/interpretation/commit code; clients are transport adapters, not parallel APIs.

## Consequences and rejected alternatives

SPEC-050 and existing adapter contracts are strengthened; data queries do not invoke Eve or depend on MCP. Rejected: per-surface data backends, app-local permission stores, bearer data links, deploy-equals-publish, copied policy engines and framework-driven domain meaning. Preserve all original C001–C157 scope; no technology qualification can be fabricated to satisfy the ambition.

## Normative contract and proof

[semantic path](../semantic-path.md). Per-ticket AC/NEG/BOUNDARY checks, current independent evidence and required operating gates control admission. Source docs inform the design but are not real product tests.

## Supersession

Refines v3 active contracts and SPEC-035; no modification to immutable historical v3/v2 input. Conflicting historical instructions defer to this amendment and the v4 constitution. Changed accepted implementation evidence must be reopened before reuse.
