# SPEC-013 — implementation algorithm

**Status: pseudocode, not an implemented service or evidence of acceptance.**

[SPEC-013](../specs/spec-013.md) · [assembly rules](../architecture/assembly-contract.md)

## Boundary and ownership

Owner: **Kernel**. Module: `packages/ontology/src/definitions`. Milestone: **S2**.

## Normative operation signatures

```text
CompileDefinitionGraph(pinnedInputs,kernelAbi) -> WorldRelease | CompilationErrors; SemanticDiff(base,candidate) -> DiffAndImpact; ValidatePlan(plan,bounds) -> TypedPlan | UnsupportedPlan.
```

## State and transaction contract

ontology.definitions(definition_digest PK,namespace,semantic_id,kind,schema_version,canonical_blob_ref); ontology.releases(release_digest PK,graph_root,surface_manifest_ref,kernel_abi,signature_ref,created_by); ontology.definition_refs(parent_digest,child_digest PK,kind). Per-user secrets and customer records never enter reusable releases.

## Shared algorithm

```text
INPUT: immutable definition graph, supported kernel/operator versions and expected base release.
VALIDATE stable semantic IDs, reference closure, field schemas, bounded resource budgets and operator allowlist.
REJECT cycles where prohibited, unbounded recursion, remote executable references and unknown operators.
TYPECHECK queries, rules, actions, Watches, views and policy requirements against one symbol table.
COMPILE to a closed deterministic IR; attach exact dependency/schema/component digests and declared journey requirements.
DERIVE cross-surface operation descriptors from that same IR, not hand-maintained transport definitions.
CANONICALIZE and hash bytes; release is immutable, active state lives only in the World control head.
RETURN deterministic diagnostics without installing definitions or granting requested powers.
```

## Ticket segments — do not reimplement the whole algorithm per file

| Ticket | Segment | Primary implementation or plan |
|---|---|---|
| [ZN-0075](../tickets/zn-0075.md) | Define object, property, link and interface JSON grammar | [packages/ontology/src/definitions/ontology-grammar.ts](../../packages/ontology/src/definitions/ontology-grammar.ts) |
| [ZN-0076](../tickets/zn-0076.md) | Implement the bounded expression and query IR | [packages/ontology/src/definitions/expression-ir.ts](../../packages/ontology/src/definitions/expression-ir.ts) |
| [ZN-0077](../tickets/zn-0077.md) | Compile runtime actions, source mappings and skills | [packages/ontology/src/definitions/capability-definitions.ts](../../packages/ontology/src/definitions/capability-definitions.ts) |
| [ZN-0078](../tickets/zn-0078.md) | Emit a single canonical graph and SurfaceManifest | [packages/ontology/src/definitions/compiler.ts](../../packages/ontology/src/definitions/compiler.ts) |
| [ZN-0079](../tickets/zn-0079.md) | Implement semantic diff, compatibility and blast radius | [packages/ontology/src/definitions/semantic-diff.ts](../../packages/ontology/src/definitions/semantic-diff.ts) |
| [ZN-0080](../tickets/zn-0080.md) | Support explicit standards interchange profiles | [packages/ontology/src/definitions/standards.ts](../../packages/ontology/src/definitions/standards.ts) |
| [ZN-0081](../tickets/zn-0081.md) | Prove deterministic compiler and hostile-program limits | [packages/ontology/src/definitions/compiler-laws.ts](../../packages/ontology/src/definitions/compiler-laws.ts) |

## Required proof boundaries

Parse/bound/validate; resolve pinned local namespaces; check stable semantic IDs; type-check units/cardinality/null/effects/realms; reject unsupported cycles; verify resource bounds; classify semantic/security changes; emit typed plans/SurfaceManifest; canonicalize and sign. Preserve ID only when meaning is unchanged. Labels may change; accounting basis cannot silently retain an incompatible meaning.

V4 refinement: The SurfaceManifest is the sole published operation discovery source for humans, agents and apps. SPEC-052 adds a bounded declarative app grammar over this graph, not a second DSL for business meaning.

No service mock, fake evidence, success stub or offline substitute is an implementation of this algorithm. Pure functions are tested directly; I/O uses actual admitted components. Missing external facts or provider APIs stay explicit admission gates.
