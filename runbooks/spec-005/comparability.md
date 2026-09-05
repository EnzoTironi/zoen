# Comparability repair — ZN-0031

**Status:** implementation-in-progress; ticket unaccepted.

```text
PRECHECK meaning profile (profileId, knowledgeVersion, releaseDigest) and authorized claim set.
OBSERVE ontology.comparison_runs; identical input+meaning_basis reuses result_digest.
PARTITION by predicate+subject+scope+valid interval; bookings/invoiced/received stay distinct metrics.
NEVER choose a winner across distinct predicates or invent a false numerical contradiction.
FORBIDDEN rivals (authorized=false) must not alter groups, explanations or confidence.
VERIFY AC (three metrics), NEG (no leak), BOUNDARY (deterministic same basis; distinct run on knowledgeVersion change).
RESUME only after independent review.
```
