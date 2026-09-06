# Subject identity (EX24 pure + EX27 handlers)

`pure/` holds EX24 algorithms. `handlers/`, `persistence/`, and `request.ts` are the EX27 semantic commit path.

`SemanticExecutor.executeSubjectIdentity` dispatches InspectSubjectIdentity, InspectIdentityRecovery, ProposeIdentityResolution, ProposeIdentitySplit, ProposeIdentityUndo, and ResolveIdentity. Mutations use `commitMutation` with domain locks, receipts and outbox. Frames store IdentityFrame / IdentityRecoveryFrame privately; decisions append to `authority.identity_decisions`.

Split proposal is intentionally unfinished in the first vertical slice (`Unavailable`). Do not treat EX27 as `verified_for_profile` until split, remaining oracles and independent review close.
