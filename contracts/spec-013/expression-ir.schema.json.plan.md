# File plan — `contracts/spec-013/expression-ir.schema.json`

**Status:** planned; no product acceptance implied.

Target: `contracts/spec-013/expression-ir.schema.json`. Representation: **sidecar-only**. Allocation: **conditional-support**.

Specs: [SPEC-013](../../docs/specs/spec-013.md).
Tickets: [ZN-0076](../../docs/tickets/zn-0076.md).

## Responsibility and reuse

```text
CONDITIONAL SCHEMA PLAN — no permissive {} schema or fabricated generated types.
RESOLVE exact input/output/tagged-error fields from the operation signatures and common protocol.
REQUIRE bounded sizes/depth/arrays, exact discriminants, validated IDs and explicit optional/null distinctions.
REJECT additional or authority-bearing client fields; money/counters stay strings where required.
GENERATE canonical fixtures, wire types and surface descriptors from this single reviewed schema source.
TEST malformed/oversized/unknown-version inputs and exact round trips; registry presence alone is not a pass.
```

## Owning state / operation contracts

### SPEC-013
CompileDefinitionGraph(pinnedInputs,kernelAbi) -> WorldRelease | CompilationErrors; SemanticDiff(base,candidate) -> DiffAndImpact; ValidatePlan(plan,bounds) -> TypedPlan | UnsupportedPlan.

ontology.definitions(definition_digest PK,namespace,semantic_id,kind,schema_version,canonical_blob_ref); ontology.releases(release_digest PK,graph_root,surface_manifest_ref,kernel_abi,signature_ref,created_by); ontology.definition_refs(parent_digest,child_digest PK,kind). Per-user secrets and customer records never enter reusable releases.

[algorithm SPEC-013](../../docs/algorithms/spec-013.md)

## Acceptance boundary

A plan is not implementation, and a compile of comment-only files proves no behavior. All relevant ticket check IDs must execute at their required layer with independent evidence. Services are not mocked; missing credentials/dependencies remain blockers.
