# File plan — `infra/terraform/app-host/variables.tf`

**Status:** planned; no product acceptance implied.

Target: `infra/terraform/app-host/variables.tf`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-053](../../../docs/specs/spec-053.md).
Tickets: [ZN-0308](../../../docs/tickets/zn-0308.md).

## Responsibility and reuse

```text
EXECUTION CONFIGURATION PLAN — not an active deployment/CI configuration.
WAIT for the actual dependency/profile admission; use genuine immutable images/actions/packages and secret references.
WIRE only already-declared processes/ports and least-privilege identities.
KEEP real provider routes disabled until qualified; no placeholder jobs returning success.
TEST plan validation and actual admitted deployment separately; no invented hashes/account IDs/certificates.
```

## Owning state / operation contracts

### SPEC-053
BindAppFrame -> BridgeBinding; TransportSemanticCall(binding,request) -> existing SemanticExecutor; CloseAppSession -> close/drain; StageStaticBundle(artifact) -> nonpublic immutable asset ref. Host confirmation invokes existing ActionCase operations.

No business authority store. Host-owned ephemeral bridge state records window identity, session binding, exact guest origin, channel nonce, request sequence, publication/artifact digest and bounded pending calls. Runner state keys include World/realm/principal/purpose/installation/version/session; shared collaboration is separately admitted. Private response/cache state is never keyed only by appId.

[algorithm SPEC-053](../../../docs/algorithms/spec-053.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
