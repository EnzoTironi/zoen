# Erasure object inventory + purge (RustFS / S3)

Adapters for `ErasureObjectInventory` and `ErasurePurgeStore`.

- Prefix derived from `WorldRef` only: `d01/{realm}/{worldId}/`.
- `ListObjectVersions` preserves opaque version IDs, including literal `"null"`.
- `purgeVersion` always sends `VersionId` (never omits it). Does **not** call `EvidenceObjectStore.remove`.
- Hold/retention inspection is fail-closed: Retention, LegalHold, or Unknown → `Blocked` / no delete.
- Product path never sets `BypassGovernanceRetention`.
