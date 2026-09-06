# EX27 core — subject-identity handlers

## Green

- `handlers.EX27.integration.test.ts` on real PG/S3/Better Auth through `SemanticExecutor.executeSubjectIdentity`.
- InspectSubjectIdentity: single snapshot, pins when claims exist, `authority.basis.v2` with `SubjectIdentityGraph` identity dependency; VisibleClaim subject keys preserved.
- ProposeIdentityResolution + ResolveIdentity (`same-as` applied).
- InspectIdentityRecovery (`comparison: not-requested`, no claims).
- ProposeIdentityUndo + ResolveIdentity confirm on recovery frame.
- ResolveIdentity `Stale` after concurrent `identity` domain bump (absence/serialization guard via retained basis).
- `handlers-split.EX27.integration.test.ts`: ProposeIdentitySplit real (not Unavailable); InvalidPartition when cover incomplete; confirm applies Withdraw + distinctions; graph separates; retained split confirm `Stale` after identity bump with no extra `identity_decisions` row.

## Remaining

- ID-08 SIGKILL + ResolveIdentity concurrency counterproofs live under `../independent/writers-*.review.integration.test.ts` (adversarial process/race; not happy-path re-run).
- Remaining broader oracles: recovery Question byte/entry limits, import-over-quota recovery journey, historical replay conflict — not yet exhaustive.
- Worker-3 independent review of split writers is in `../independent/split-writers.review.integration.test.ts` (adversarial; not a happy-path re-run).
- Root integrator: migration `008_subject_identity_events.sql` wired into `applyIdentityBasisMigrations` and test DB fixture; executor family `executeSubjectIdentity` registered.
