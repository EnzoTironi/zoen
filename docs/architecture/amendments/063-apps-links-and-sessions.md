# ADR-063 — Protected apps, links and sessions

Status: accepted design amendment for v4; implementation/qualification pending. Date: 2026-09-04.

## Decision

Declarative app definitions are default; publication, sharing and authorization are separate; a link carries no authority.

## Consequences and rejected alternatives

Private asset bootstrap is host mediated. AppSession pins code/meaning but not old rights. Private guest disclosure needs explicit policy; iframe is not universal browser DLP. Rejected: per-surface data backends, app-local permission stores, bearer data links, deploy-equals-publish, copied policy engines and framework-driven domain meaning. Preserve all original C001–C157 scope; no technology qualification can be fabricated to satisfy the ambition.

## Normative contract and proof

[apps](../mini-app-contract.md), [links](../protected-links.md), [host](../app-host-security.md). Per-ticket AC/NEG/BOUNDARY checks, current independent evidence and required operating gates control admission. Source docs inform the design but are not real product tests.

## Supersession

Refines v3 active contracts and SPEC-035; no modification to immutable historical v3/v2 input. Conflicting historical instructions defer to this amendment and the v4 constitution. Changed accepted implementation evidence must be reopened before reuse.
