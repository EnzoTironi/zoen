# Independent review before initial acceptance

This is a review queue, not a claim that an independent review occurred.

1. Compile every module with the real target packages. Confirm exact dependency types and deployment ABI. The dependency-independent compiler pass is insufficient.
2. Execute migration/role tests against PostgreSQL 18. Review all composite foreign keys, source/claim edges, nullable CHECK behavior, RLS contexts and migration idempotency. Demonstrate immutable history privileges; do not infer them from the SQL text.
3. Exercise current authorization before idempotent replay and data disclosure. Test revoked membership, source quarantine, concurrent policy changes, hidden predecessor/successor claims and cross-World IDs.
4. Audit read-set coverage, missing predicates/absence guards, knowledge cuts, definition closure and state transitions. Prove actual concurrent histories, not just comparisons of synthetic cuts.
5. Qualify immutable object identity, exact version reads, orphan uploads, resource budgets, S3/PG boundary failure, retention and encrypted recovery. Current stage/open methods do not solve the full lifecycle.
6. Verify real Better Auth schema/session behavior, origin checks, rate limits and password-account assurance. Add verified email/passkey/step-up flows only through the proper contracts.
7. Finish accessible UI, guided source correction and inspectable evidence through the shared executor. Missing UI cannot be replaced by a passing CLI request.
8. Implement the complete release/evaluation/preparation lifecycle before allowing a model/user to alter authoritative definitions. Remove no fail-closed guard merely to make a demonstration work.
9. For mini apps, implement real persistent links/sessions/host restrictions and denial tests; validate all app/API/batch/export/subscription paths. Current helper tests do not qualify a hosted application.
10. Produce trusted CI evidence and independent reviewer sign-off per the original ticket. No ticket is accepted by this checklist or this delivery.
