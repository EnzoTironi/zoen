# Extraction repair — ZN-0028

**Status:** implementation-in-progress; ticket unaccepted.

```text
PRECHECK UTF-8 CSV/JSON bytes and explicit delimiter/header/locale or pinned JSON schema.
OBSERVE ontology.extraction_runs + extraction_candidates; identical bytes reuse result_digest.
ON undeclared locale for grouped numerics (e.g. 1,234) or conflicting invoice values: Quarantined.
VERIFY candidate coordinates (row/field/column) deterministic across reruns.
RESUME only after independent review.
```
