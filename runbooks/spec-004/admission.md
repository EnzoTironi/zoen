# Source admission repair — ZN-0026

**Status:** implementation-in-progress; ticket unaccepted.

```text
PRECHECK ZOEN_TEST_DATABASE_URL and staged captures with verified digests.
OBSERVE ontology.source_admissions + evidence/claims; identical content admits once.
ON same external revision with altered digest: Conflict SOURCE_REVISION_DIGEST_ANOMALY — never overwrite.
VERIFY rights_ref/retention_ref recorded; capture state becomes admitted.
RESUME only after independent review.
```
