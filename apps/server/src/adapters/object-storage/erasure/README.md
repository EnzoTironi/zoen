# Erasure object inventory + purge (RustFS / S3)

Adapters for `ErasureObjectInventory` and `ErasurePurgeStore`.

- Prefix derived from `WorldRef` only: `worlds/{realm}/{worldId}/`.
- `ListObjectVersions` preserves opaque version IDs, including literal `"null"`.
- `purgeVersion` always sends `VersionId` (never omits it). Does **not** call `EvidenceObjectStore.remove`.
- Hold/retention inspection is fail-closed: Retention, LegalHold, or Unknown → `Blocked` / no delete.
- Product path never sets `BypassGovernanceRetention`.

- `ListMultipartUploads` inventories in-progress uploads under the World prefix (ZA-10).
- Non-empty multipart or sticky `unknown` object-write attempts block purge completion.
- G-STORAGE-FENCE (provider late-PUT / credential retirement) remains **Blocked** — Object Lock ≠ writer fence.
