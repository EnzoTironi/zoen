# SPEC-051 — Authority-free continuation links and scoped application sessions

**Milestone:** S1 · **Owner:** Identity and Application Host · **Root:** `packages/ontology/src/continuations`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
A link identifies an authorized continuation target; it is never a bearer World grant. Opening, authenticating, approving publication and sharing are distinct operations. Reuse Focus and Door; no second login or mini-app ACL database.

## Owned state and storage contract
ontology.continuations(link_ref PK,world_id,realm,focus_ref,target_kind,target_ref,version_policy,recipient_constraint_nullable,expires_at_nullable,state,creator,created_receipt); target_kind=focus|app. ontology.app_sessions(session_ref PK,world_id,realm,principal,actor,installation_ref_nullable,publication_binding,scope_digest,purpose,assurance,security_revision,expires_at,state). Relationships/World grants remain existing ontology records. Opaque handles have at least 192 random bits; logs are redacted. Door owns browser challenge records, not app business permissions.

## Operations

```text
CreateContinuation(target,scope,recipient?,expiry?,operationId) -> LinkRef; ResolveContinuation(ref) -> GenericLanding|AuthorizedTarget; OpenApp(ref,verifiedPresence) -> AppSession|Denied; RevokeContinuation(ref) -> Receipt; RevokeAppSession(ref) -> Receipt.
```

## Execution protocol
GET/HEAD, previews and unauthenticated asset requests are generic and side-effect free. POST exchange uses CSRF/origin protections, a browser-bound challenge and verified identity before disclosure. No access token in the URL. Invitation acceptance is a separate governed operation. Every later semantic call checks current rights; link expiry and session revocation are enforced independently. Archived historical views use current rights and cannot reactivate recalled code.

Detailed routes, challenge states, version modes, scopes and cache behavior: [protected links](../architecture/protected-links.md). S1 only supports private Focus; S2 adds private app continuation; S3 admits sharing. Application sessions never substitute for current semantic authorization.

## Pseudocode and file ownership

[algorithm SPEC-051](../algorithms/spec-051.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0296](../tickets/zn-0296.md) | Implement authority-free continuation references over Focus | component | [ZN-0015](../tickets/zn-0015.md), [ZN-0291](../tickets/zn-0291.md) |
| [ZN-0297](../tickets/zn-0297.md) | Implement browser-bound authenticated continuation exchange | component | [ZN-0013](../tickets/zn-0013.md), [ZN-0296](../tickets/zn-0296.md) |
| [ZN-0298](../tickets/zn-0298.md) | Verify link preview, logout and shared-device privacy | journey | [ZN-0073](../tickets/zn-0073.md), [ZN-0297](../tickets/zn-0297.md) |
| [ZN-0299](../tickets/zn-0299.md) | Implement scoped app-session open, expiry and revocation | component | [ZN-0293](../tickets/zn-0293.md), [ZN-0297](../tickets/zn-0297.md), [ZN-0304](../tickets/zn-0304.md) |
| [ZN-0300](../tickets/zn-0300.md) | Share app references without changing membership or lending rights | component | [ZN-0107](../tickets/zn-0107.md), [ZN-0299](../tickets/zn-0299.md) |
| [ZN-0301](../tickets/zn-0301.md) | Prove protected app access in deployed host and browser profiles | admission | [ZN-0290](../tickets/zn-0290.md), [ZN-0298](../tickets/zn-0298.md), [ZN-0300](../tickets/zn-0300.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `interfaces-sdk-and-mcp.md`, `rights-and-access-control.md`. Read a named historical reference only when needed; it cannot override current contracts.
