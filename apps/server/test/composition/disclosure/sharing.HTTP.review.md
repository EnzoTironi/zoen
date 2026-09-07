# Independent HTTP sharing journey

Baseline: committed production `9701de4`, with the earlier response/Scope emitter. Only this independent test and report were added. The test uses `withWorldsHttp`: a real TCP Node Effect HTTP server, isolated PostgreSQL database with normal component login roles, Better Auth accounts, and versioned S3-compatible storage. The only account IDs come from validated real signup responses. No mocked services, fabricated provider responses, privileged application identities, or emitter hooks are used.

Executed on 2026-09-05:

```text
node --env-file=.env.infra node_modules/vitest/vitest.mjs run --project integration apps/server/test/composition/disclosure/sharing.HTTP.review.integration.test.ts --maxWorkers=1
1 test passed; 1.61 s total, 802 ms test time
```

The owner creates a World, imports evidence, and creates/confirms a private correction through HTTP. The owner then inspects an absent recipient and grants that exact Better Auth account viewer access. The viewer reads the same claims/provenance and exact document bytes, observes no owner correction, and creates/rereads its own Frame.

Fourteen denied requests cover owner Frames (original and corrected), viewer import, proposal, another principal's Question answer, undo, membership inspection/management, and stranger reads/management. A stranger's nonexistent World request has the same closed denial payload/status as the inaccessible existing World. Before/after snapshots of every authority table plus jobs captures/outbox remain identical across this batch. SQL is used only for independent observation; every product action uses HTTP. This is not an S3 bucket-level negative-write measurement or a general observational-equivalence proof.

Public revoke produces revision 1 and prevents new Inspect, OpenEvidence, retained-Frame reading and self-membership inspection. Replaying the exact original grant yields the exact historical grant DTO, creates no semantic SQL writes, and leaves current membership revoked. A new operation with expected revision 1 regrants at revision 2; the viewer can again open the same evidence and reread its own retained Frame.

Every semantic HTTP response checks its expected status, JSON content type, `no-store`, `no-referrer`, `nosniff`, UUID request ID and exact UTF-8 content length. The imported document includes non-ASCII text, and the opened document is compared exactly, so byte-length checks do not silently substitute character counts. Public success DTOs are decoded through their real schemas.

These executed witnesses contribute to SH-01/02/04/06. They do not prove SH-08, coordinator-loss ordering, native-emitter finalization, CLI/browser parity, all audience equivalence dimensions, or acceptance of D03. The baseline must be rerun after the durable adapter/native emitter are integrated; passing on the old emitter does not establish the late-disclosure fence.
