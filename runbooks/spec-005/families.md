# Source-family collapse repair — ZN-0032

**Status:** implementation-in-progress; ticket unaccepted.

```text
PRECHECK closed evidence graph (all parents present); reject cycles and self-parents.
COLLAPSE copy/derived ancestry under one original root → independentSupport=1 per family.
KEEP every evidence id attributable (lineage never deleted).
VERIFY ten copies + one independent rival → support count 2; copy-family lineage 11 kept; total attributable 12.
INVALID kind/id/cycle → InvalidInput without I/O or coercion.
RESUME only after independent review.
```
