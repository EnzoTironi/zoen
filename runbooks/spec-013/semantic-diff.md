# File plan — `runbooks/spec-013/semantic-diff.md`

**Status:** planned; no product acceptance implied.

Target: `runbooks/spec-013/semantic-diff.md`. Representation: **markdown-plan**. Allocation: **required**.

Specs: [SPEC-013](../../docs/specs/spec-013.md).
Tickets: [ZN-0079](../../docs/tickets/zn-0079.md).

## Responsibility and reuse

## ZN-0079 operational/repair procedure

Scope: Implement semantic diff, compatibility and blast radius. This is a plan; deployments and commands not yet qualified remain blocked.

```text
PRECHECK exact environment/profile, operator authority, ticket evidence and affected World/realm.
STOP new admissions/dispatch for the affected scope before destructive or ambiguous repair.
OBSERVE actual durable state and raw error at this ticket boundary:
Diff runs between releases
PRESERVE original intent/receipt/provider identities and evidence; never reset a tenant to get a green run.
REPAIR under the owning module protocol:
INPUT: immutable definition graph, supported kernel/operator versions and expected base release.
VALIDATE stable semantic IDs, reference closure, field schemas, bounded resource budgets and operator allowlist.
REJECT cycles where prohibited, unbounded recursion, remote executable references and unknown operators.
TYPECHECK queries, rules, actions, Watches, views and policy requirements against one symbol table.
COMPILE to a closed deterministic IR; attach exact dependency/schema/component digests and declared journey requirements.
DERIVE cross-surface operation descriptors from that same IR, not hand-maintained transport definitions.
CANONICALIZE and hash bytes; release is immutable, active state lives only in the World control head.
RETURN deterministic diagnostics without installing definitions or granting requested powers.
VERIFY the original oracle plus negative and boundary cases on real admitted components:
It identifies migration and Case compatibility requirements; the change cannot be activated as presentation-only
RESUME only with current approval and intact unrelated tenant scopes.
```

## Owning state / operation contracts

### SPEC-013
CompileDefinitionGraph(pinnedInputs,kernelAbi) -> WorldRelease | CompilationErrors; SemanticDiff(base,candidate) -> DiffAndImpact; ValidatePlan(plan,bounds) -> TypedPlan | UnsupportedPlan.

ontology.definitions(definition_digest PK,namespace,semantic_id,kind,schema_version,canonical_blob_ref); ontology.releases(release_digest PK,graph_root,surface_manifest_ref,kernel_abi,signature_ref,created_by); ontology.definition_refs(parent_digest,child_digest PK,kind). Per-user secrets and customer records never enter reusable releases.

[algorithm SPEC-013](../../docs/algorithms/spec-013.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
