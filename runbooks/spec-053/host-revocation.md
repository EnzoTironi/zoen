# File plan — `runbooks/spec-053/host-revocation.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-053/host-revocation.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-053](../../docs/specs/spec-053.md).
Tickets: [ZN-0311](../../docs/tickets/zn-0311.md).

## Responsibility and reuse

## ZN-0311 operational/repair procedure

Scope: Enforce session revocation, streaming and host confirmation boundaries. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Rights are revoked before the queue flush or form commit
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
LOAD approved publication and current app session in trusted host; select admitted declarative/executable disclosure profile.
SERVE approved guest assets on isolated registered-site origin; strip credentials and never embed private bootstrap data.
BIND exact frame window, artifact/session, nonce and MessageChannel before accepting bounded typed messages.
FOR each permitted request call existing SemanticClient with verified server context; bridge owns no policy or business handler.
DENY generic fetch/open-url/SQL/provider proxies; strip Cookie/Authorization/forwarded identity and unsafe response headers.
ISOLATE mutable backend state by World/realm/principal/purpose/version/session unless explicit shared collaboration is admitted.
REAUTHORIZE every call/stream/export and clear host-owned caches on revoke; close affected guests without promising to erase copied data.
SHOW consequential confirmations in trusted chrome from server Case; guest approval text has no authority.
DISCLOSE private data to executable code only under explicit qualified exposure profile; iframe/signature alone cannot prevent copying.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
No new protected frame/chunk is dispatched; form commit is denied or stale by the same central executor; guest HTML cannot synthesize approval
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-053
BindAppFrame -> BridgeBinding; TransportSemanticCall(binding,request) -> existing SemanticExecutor; CloseAppSession -> close/drain; StageStaticBundle(artifact) -> nonpublic immutable asset ref. Host confirmation invokes existing ActionCase operations.

No business authority store. Host-owned ephemeral bridge state records window identity, session binding, exact guest origin, channel nonce, request sequence, publication/artifact digest and bounded pending calls. Runner state keys include World/realm/principal/purpose/installation/version/session; shared collaboration is separately admitted. Private response/cache state is never keyed only by appId.

[algorithm SPEC-053](../../docs/algorithms/spec-053.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
