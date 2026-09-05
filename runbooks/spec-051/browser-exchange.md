# File plan — `runbooks/spec-051/browser-exchange.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-051/browser-exchange.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-051](../../docs/specs/spec-051.md).
Tickets: [ZN-0297](../../docs/tickets/zn-0297.md).

## Responsibility and reuse

## ZN-0297 operational/repair procedure

Scope: Implement browser-bound authenticated continuation exchange. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
The wrong browser posts a copied challenge while the intended browser authenticates
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
CREATE a random opaque link reference for permitted Focus/app target, recipient constraint, version policy and optional expiry.
STORE no access token in URL; creation, publication, invitation and sharing remain distinct operations.
GET/HEAD/previews return generic side-effect-free content without data, challenge consumption or target existence leaks.
ON explicit POST exchange validate CSRF/origin and browser-bound challenge, then verify Door identity/assurance.
RESOLVE target through current World membership, recipient constraint, app publication/recall and source rights.
ISSUE server-side scoped session bound to principal/actor/World/realm/purpose/exact publication/security revision/expiry.
ON every later semantic call recheck session and current rights; stable link never preserves old grants.
REVOKE link and session independently; historical rendering cannot revive recalled code or erased content.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Only the correctly bound authenticated recipient can exchange; possession of the reference alone is insufficient
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-051
CreateContinuation(target,scope,recipient?,expiry?,operationId) -> LinkRef; ResolveContinuation(ref) -> GenericLanding|AuthorizedTarget; OpenApp(ref,verifiedPresence) -> AppSession|Denied; RevokeContinuation(ref) -> Receipt; RevokeAppSession(ref) -> Receipt.

ontology.continuations(link_ref PK,world_id,realm,focus_ref,target_kind,target_ref,version_policy,recipient_constraint_nullable,expires_at_nullable,state,creator,created_receipt); target_kind=focus|app. ontology.app_sessions(session_ref PK,world_id,realm,principal,actor,installation_ref_nullable,publication_binding,scope_digest,purpose,assurance,security_revision,expires_at,state). Relationships/World grants remain existing ontology records. Opaque handles have at least 192 random bits; logs are redacted. Door owns browser challenge records, not app business permissions.

[algorithm SPEC-051](../../docs/algorithms/spec-051.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
