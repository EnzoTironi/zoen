# SPEC-013 — Bounded ontology grammar and deterministic release compiler

**Milestone:** S2 · **Owner:** Kernel · **Root:** `packages/ontology/src/definitions`

**Status:** normative design; candidate code may overlap; no ticket is accepted by file presence.

## Decision
Business variation is versioned data executed by a closed, total, bounded grammar. No JavaScript, arbitrary SQL, remote schema fetch or model invocation executes inside authority. One compiler emits semantic plans and all public surface metadata.

## Owned state and storage contract
ontology.definitions(definition_digest PK,namespace,semantic_id,kind,schema_version,canonical_blob_ref); ontology.releases(release_digest PK,graph_root,surface_manifest_ref,kernel_abi,signature_ref,created_by); ontology.definition_refs(parent_digest,child_digest PK,kind). Per-user secrets and customer records never enter reusable releases.

## Operations

```text
CompileDefinitionGraph(pinnedInputs,kernelAbi) -> WorldRelease | CompilationErrors; SemanticDiff(base,candidate) -> DiffAndImpact; ValidatePlan(plan,bounds) -> TypedPlan | UnsupportedPlan.
```

## Execution protocol
Parse/bound/validate; resolve pinned local namespaces; check stable semantic IDs; type-check units/cardinality/null/effects/realms; reject unsupported cycles; verify resource bounds; classify semantic/security changes; emit typed plans/SurfaceManifest; canonicalize and sign. Preserve ID only when meaning is unchanged. Labels may change; accounting basis cannot silently retain an incompatible meaning.

V4 refinement: The SurfaceManifest is the sole published operation discovery source for humans, agents and apps. SPEC-052 adds a bounded declarative app grammar over this graph, not a second DSL for business meaning.

V4 normative detail: [single semantic path](../architecture/semantic-path.md).

## Pseudocode and file ownership

[algorithm SPEC-013](../algorithms/spec-013.md). All typed source plans, test plans and conditional artifacts are mapped in [the file registry](../../planning/files.json).

## Work items

| Ticket | Scope | Layer | Dependencies |
|---|---|---|---|
| [ZN-0075](../tickets/zn-0075.md) | Define object, property, link and interface JSON grammar | component | [ZN-0012](../tickets/zn-0012.md), [ZN-0024](../tickets/zn-0024.md), [ZN-0046](../tickets/zn-0046.md) |
| [ZN-0076](../tickets/zn-0076.md) | Implement the bounded expression and query IR | component | [ZN-0075](../tickets/zn-0075.md) |
| [ZN-0077](../tickets/zn-0077.md) | Compile runtime actions, source mappings and skills | component | [ZN-0076](../tickets/zn-0076.md) |
| [ZN-0078](../tickets/zn-0078.md) | Emit a single canonical graph and SurfaceManifest | component | [ZN-0077](../tickets/zn-0077.md) |
| [ZN-0079](../tickets/zn-0079.md) | Implement semantic diff, compatibility and blast radius | component | [ZN-0078](../tickets/zn-0078.md) |
| [ZN-0080](../tickets/zn-0080.md) | Support explicit standards interchange profiles | component | [ZN-0079](../tickets/zn-0079.md) |
| [ZN-0081](../tickets/zn-0081.md) | Prove deterministic compiler and hostile-program limits | law | [ZN-0080](../tickets/zn-0080.md) |

## Contract precedence and limits

[Constitution](../architecture/constitution.md) → this spec → ticket oracle → algorithm/file plan. A comment scaffold does not define new authority or override a schema. Contradictions stop execution with `SpecConflict`.

## Historical sources

[Archived source locators](../lineage/source-ledger.md): `ontology-and-standards.md`, `release-engine-and-compiler.md`. Read a named historical reference only when needed; it cannot override current contracts.
