# Subject identity CLI (EX28)

Thin command assembly for `InspectSubjectIdentity`, `InspectIdentityRecovery`, `ProposeIdentityResolution`, `ProposeIdentitySplit`, `ProposeIdentityUndo`, and `ResolveIdentity`. Transport posts to `/api/subject-identity/execute`.

Retry: reuse the same `--operation-id` and consequence digest on Unavailable. Stale requires a new inspect and a newly confirmed operation id.
