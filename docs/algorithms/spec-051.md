# SPEC-051 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-051](../specs/spec-051.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Identity and Application Host**. Module: `packages/ontology/src/continuations`. Milestone: **S1**.

## Normative operation signatures

```text
CreateContinuation(target,scope,recipient?,expiry?,operationId) -> LinkRef; ResolveContinuation(ref) -> GenericLanding|AuthorizedTarget; OpenApp(ref,verifiedPresence) -> AppSession|Denied; RevokeContinuation(ref) -> Receipt; RevokeAppSession(ref) -> Receipt.
```

## State and transaction contract

ontology.continuations(link_ref PK,world_id,realm,focus_ref,target_kind,target_ref,version_policy,recipient_constraint_nullable,expires_at_nullable,state,creator,created_receipt); target_kind=focus|app. ontology.app_sessions(session_ref PK,world_id,realm,principal,actor,installation_ref_nullable,publication_binding,scope_digest,purpose,assurance,security_revision,expires_at,state). Relationships/World grants remain existing ontology records. Opaque handles have at least 192 random bits; logs are redacted. Door owns browser challenge records, not app business permissions.

## Shared algorithm

```text
CREATE a random opaque link reference for permitted Focus/app target, recipient constraint, version policy and optional expiry.
STORE no access token in URL; creation, publication, invitation and sharing remain distinct operations.
GET/HEAD/previews return generic side-effect-free content without data, challenge consumption or target existence leaks.
ON explicit POST exchange validate CSRF/origin and browser-bound challenge, then verify Door identity/assurance.
RESOLVE target through current World membership, recipient constraint, app publication/recall and source rights.
ISSUE server-side scoped session bound to principal/actor/World/realm/purpose/exact publication/security revision/expiry.
ON every later semantic call recheck session and current rights; stable link never preserves old grants.
REVOKE link and session independently; historical rendering cannot revive recalled code or erased content.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0296](../tickets/zn-0296.md) | Implement authority-free continuation references over Focus | [packages/ontology/src/continuations/continuation-registry.ts](../../packages/ontology/src/continuations/continuation-registry.ts) |
| [ZN-0297](../tickets/zn-0297.md) | Implement browser-bound authenticated continuation exchange | [packages/door/src/continuation/browser-exchange.ts](../../packages/door/src/continuation/browser-exchange.ts) |
| [ZN-0298](../tickets/zn-0298.md) | Verify link preview, logout and shared-device privacy | [tests/journey/spec-051/continuation-browser-proof.test.ts](../../tests/journey/spec-051/continuation-browser-proof.test.ts) |
| [ZN-0299](../tickets/zn-0299.md) | Implement scoped app-session open, expiry and revocation | [packages/ontology/src/continuations/app-sessions.ts](../../packages/ontology/src/continuations/app-sessions.ts) |
| [ZN-0300](../tickets/zn-0300.md) | Share app references without changing membership or lending rights | [apps/web/src/mini-apps/app-sharing.ts](../../apps/web/src/mini-apps/app-sharing.ts) |
| [ZN-0301](../tickets/zn-0301.md) | Prove protected app access in deployed host and browser profiles | [admissions/spec-051/protected-link-admission.json](../../admissions/spec-051/protected-link-admission.json.plan.md) |

## Required proof boundaries

GET/HEAD, previews and unauthenticated asset requests are generic and side-effect free. POST exchange uses CSRF/origin protections, a browser-bound challenge and verified identity before disclosure. No access token in the URL. Invitation acceptance is a separate governed operation. Every later semantic call checks current rights; link expiry and session revocation are enforced independently. Archived historical views use current rights and cannot reactivate recalled code.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
