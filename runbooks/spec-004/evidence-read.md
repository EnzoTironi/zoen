# Evidence read repair — ZN-0027

**Status:** implementation-in-progress; ticket unaccepted.

```text
PRECHECK ZOEN_TEST_DATABASE_URL, admitted evidence rows, and current grants.
OBSERVE ontology.source_admissions content_state + ontology.evidence_read_receipts.
ON grant expiry/revocation or security_revision bump: no bytes and no storage locator.
ON retention expiry/erasure with valid grant: HistoricalContentUnavailable + receipt metadata only.
VERIFY object_key never appears in AuthorizedStream / HistoricalContentUnavailable payloads.
RESUME only after independent review.
```
