# Execution amendment 061 — make ownership, sequencing and proof explicit

Status: adopted in execution v3; the original v2 documents are unchanged.

The v2 blueprint defines capability scope and architecture, but its sample contracts and broad slices leave execution choices implicit. V3 adds normative cross-cutting protocol/storage ownership, per-spec algorithms, bounded work items and exact acceptance check identities. It does not change the three-product roots or move truth/permission into conversation.

Accepted refinements: split bootstrap presence from Ontology genesis to reuse one authority primitive without a dependency cycle; preserve interpretation axes and add explicit blocked/cancelled action states; distinguish code completion from provider/profile admission; allow labeled pure-law/protocol evidence without substituting it for real dependency proof; introduce the S1 minimal hosted profile separately from S9; and use task-level evidence/dependency/write-set constraints.

Alternatives rejected: mechanically making one ticket per capability; a generic “implement module” backlog; all work blocked by every external credential; a green check based only on test discovery count; customer-specific kernels; duplicating authority during bootstrap; and claiming commercial/platform parity from design coverage.

Consequences: more explicit contracts and independent review obligations; bounded models stop on missing semantics instead of silently resolving them; operational scope remains blocked until real qualification. Tooling checks artifact integrity but cannot authenticate a fabricated log or reviewer by itself. Trusted CI and review are part of execution, not a guarantee supplied by this ZIP.

Verification: dependency-DAG check, bootstrap and pilot sequencing tests, capability/check coverage, immutable baseline hashes and evidence rejection tests. Product proofs remain the future required checks in the backlog.
