# File plan — `runbooks/spec-052/private-app-journey.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-052/private-app-journey.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-052](../../docs/specs/spec-052.md).
Tickets: [ZN-0305](../../docs/tickets/zn-0305.md).

## Responsibility and reuse

## ZN-0305 operational/repair procedure

Scope: Ship the private read-only mini-app first-use journey. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Each owner asks Eve to create a read-only app, evaluates it and opens the supplied link
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
VALIDATE immutable app definition against approved component versions, typed bindings, resource limits and accessibility labels.
REJECT arbitrary script/HTML/eval/provider URLs/SQL and hidden data bindings in declarative mode.
RESOLVE query/action bindings to stable released semantic operations; presentation cannot manufacture authoritative metrics.
INSTANTIATE template parameters as ordinary allowed instance change only when semantics/powers stay unchanged.
FOR changed definitions use existing compile/evaluate/prepare/approve/activate path; create, publish and share are separate.
OPEN app through protected session and reuse the common semantic client for all data, subscriptions and exports.
RENDER read-only defaults, conflicts and missing values faithfully; consequential forms use trusted ActionCase confirmation.
UPGRADE/uninstall/recall through versioned release/artifact lifecycle; no mutable runtime latest alias as authority.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
Both apps work without Rivet, dense storage, full Studio or arbitrary tools; meanings remain equivalent to CLI and Eve at the same basis
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-052
ValidateMiniApp(definition,baseRelease) -> ValidatedManifest|Errors; InstantiateAppTemplate(template,parameters) -> DefinitionChange|InstanceAction; PublishApp(change) -> existing release process; OpenView(session,bindings) -> SemanticCalls through SPEC-050.

MiniAppDefinition closes over appId, pages, approved component registry versions, query/action bindings, form schemas, requested capabilities, resource budget and accessibility labels. It is immutable release content. AppPublicationBinding(appId, manifestDigest, mode, optional artifactDigest, runtimeProfileRef) belongs to the released graph. Drafts remain existing builder_drafts; no mutable runtime latest alias is authority.

[algorithm SPEC-052](../../docs/algorithms/spec-052.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
