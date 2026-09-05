# Capture staging repair — ZN-0025

**Status:** implementation-in-progress; ticket unaccepted.

```text
PRECHECK ZOEN_TEST_DATABASE_URL + admitted object store (MinIO/S3) profile.
OBSERVE ontology.captures state/digest/blob_ref; never invent evidence/claim rows from StageCapture.
QUARANTINE oversized, archive, path-traversal, media mismatch, or failed object-store uploads.
VERIFY only durable digest-verified CSV/JSON/text becomes state=staged.
RESUME only after independent review.
```
