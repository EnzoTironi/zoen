# EX27 core — vertical slice

## Green

- `handlers.EX27.integration.test.ts` on real PG/S3/Better Auth through `SemanticExecutor.executeSubjectIdentity`.
- InspectSubjectIdentity: single snapshot, pins when claims exist, `authority.basis.v2` with `SubjectIdentityGraph` identity dependency; VisibleClaim subject keys preserved.
- ProposeIdentityResolution + ResolveIdentity (`same-as` applied).
- InspectIdentityRecovery (`comparison: not-requested`, no claims).
- ProposeIdentityUndo + ResolveIdentity confirm on recovery frame.
- ResolveIdentity `Stale` after concurrent `identity` domain bump (absence/serialization guard via retained basis).

## Remaining

- ProposeIdentitySplit still returns `Unavailable` (planner not landed).
- Broader ID-01/08–14 oracles (concurrency interleaving, SIGKILL atomicity, import-over-quota recovery journey, historical replay conflict) not yet in this folder.
- Worker-3 independent review outstanding.
- Root integrator: migration `008_subject_identity_events.sql` wired into `applyIdentityBasisMigrations` and test DB fixture; executor family `executeSubjectIdentity` registered.
