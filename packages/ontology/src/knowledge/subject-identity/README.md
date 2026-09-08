# Subject identity (EX24 pure + EX27 handlers)

`pure/` holds EX24 algorithms. `handlers/`, `persistence/`, and `request.ts` are the EX27 semantic commit path.

`SemanticExecutor.executeSubjectIdentity` dispatches InspectSubjectIdentity, InspectIdentityRecovery, ProposeIdentityResolution, ProposeIdentitySplit, ProposeIdentityUndo, and ResolveIdentity. Mutations use `commitMutation` with domain locks, receipts and outbox. Frames store IdentityFrame / IdentityRecoveryFrame privately; decisions append to `authority.identity_decisions`.

`ProposeIdentitySplit` is real: `planSplitEffects` builds Withdraw + full cross-block `different-from` Assert drafts (or blocks `confirm` with `InvalidPartition` / `QuotaExceeded`), then the handler freezes an `identity-split` / `identity-recovery-split` Question and Resolve applies atomically. Do not mark EX27 `verified_for_profile` until remaining ID-01/08–14 oracles and independent review close.
