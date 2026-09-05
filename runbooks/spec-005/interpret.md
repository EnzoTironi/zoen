# Interpretation repair — ZN-0033

**Status:** implementation-in-progress; ticket unaccepted.

```text
PRECHECK queryDigest + cut/release basis; authorized candidates only.
WITHOUT precedence rule: multiple disagreeing comparable rivals → unresolved + contested.
WITH authorized revision rule: select preferred claim, retain rivals, contested unless resolvesContestation.
NEVER use arrivalOrdinal / modelConfidence / userConfidence as default precedence.
IDENTICAL input+basis → same interpretation_id/result_digest; changed cut → new row.
RESUME only after independent review.
```
