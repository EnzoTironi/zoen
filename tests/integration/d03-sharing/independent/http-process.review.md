# Independent two-process HTTP disclosure ordering

Production base: `c60eff8`. The reviewer built its own compiled server/authority/contracts with `tsc --build apps/server/tsconfig.build.json --force` in an isolated worktree. Neither the existing CSV server nor another worktree's build was changed. The unchanged public sharing journey also passed independently on this base: 1 test, 1.65 seconds total / 876 ms test time.

## Harness and boundaries

The three sibling TypeScript files launch two separate Node processes, each importing the real compiled `makeD01Application`, listening on its own TCP port, and sharing the same isolated PostgreSQL database, S3 bucket, installation, data policy and identity secret. Each process uses its actual origin. Configuration files are mode 0600 inside a mode-0700 temporary directory. Accounts, World creation, import, grant, read, revoke and logout all use public HTTP. The session ID used for coordination comes from authenticated `/api/auth/get-session`, not a fabricated presence or provider response.

The reader process observes two actual native calls. Before the matching shared-lock query, it can pause before delegating the original `pg.Client.query`. This point follows production request preparation/serialization and precedes permit admission. Alternatively, it pauses inside `ServerResponse.end` before delegating the original method with the original receiver and bytes. This point follows the production final revalidation and transition to `attempting`. File sentinels and `Atomics.wait` block only that child process. The sibling server continues to handle the competing public operation. Neither observer replaces the executor, SQL result, identity provider, storage, or response body.

Membership revocation's blocking exclusive lock is observed as an ungranted `ExclusiveLock` in real `pg_locks`. Logout uses a nonblocking try-exclusive loop, so its refusal is observed through the actual PostgreSQL callback returning `confirmed=false`; the callback and its unchanged arguments are forwarded exactly once. In both late cases, the migration observer identifies the single granted shared-lock holder, then the test-admin connection terminates that exact backend with `pg_terminate_backend`. This is explicit fault injection, never product authorization.

## Executed results

Command:

```text
node --env-file=.env.infra node_modules/vitest/vitest.mjs run --project integration tests/integration/d03-sharing/independent/http-process.review.integration.test.ts --maxWorkers=1
```

All **4 tests passed** on 2026-09-05: 13.99 seconds total / 11.89 seconds test time. Whole-worktree `tsc --noEmit` and focused lint subsequently passed. The native-only observer file has a narrow documented exemption from the suggestion to replace Node `fs`/`http` imports with Effect APIs: synchronous blocking at those native boundaries is the purpose of this harness.

| Public operation and pause | Observed order and result |
| --- | --- |
| Revoke before reader's membership shared lock | No pending permit exists. Public revoke returns 200/revision 1. Releasing the reader yields exactly 404 `NotFoundOrDenied`; no private document; pending returns to zero. |
| Revoke after final revalidation, inside native end | Pending is 1 and exclusive membership lock is waiting. Semantic state remains unchanged. Killing the physical reader coordinator allows the exclusive lock but public revoke returns 503 `Unavailable`; membership revision, receipts, operations and outbox remain unchanged, pending remains 1. Releasing native end yields exact original document JSON once; ACK removes the permit. Retrying the **same operation ID and intention** returns 200/revision 1; a new read returns 404. |
| Logout before reader's session shared lock | Public signout returns 200. The exact provider session ID is absent and its durable closing barrier exists. Releasing the prepared reader yields exactly 503 `Unavailable`; no private document; no pending permit remains. Membership and semantic receipt/operation/outbox state remain unchanged. |
| Logout after final revalidation, inside native end | A real try-exclusive returns false while the session shared lock and pending permit remain. After coordinator termination, signout returns 503 `{code:"UNAVAILABLE"}`. The exact session still exists, no closing barrier was committed, pending remains 1, and semantic state is unchanged. Releasing native end yields exact original document JSON once; after observed ACK zero, retry with the **same cookie** returns 200, the exact session ID is absent, and its closing barrier persists. A new read with that cookie returns 401 `Unauthenticated`. |

The late private response is allowed because the competing revoke/logout did **not** confirm. The successful retry happens only after factual acknowledgment, and subsequent reads are denied. Original document equality, UTF-8 content length, security headers and exactly one `end.return` event are checked for the late successful read.

## Initial failure retained

The first four-case run produced 3 passes and 1 failure at the late logout error-envelope assertion: actual HTTP 503 body was `{code:"UNAVAILABLE"}`, while the test initially expected `{_tag:"Unavailable",code:"UNAVAILABLE"}`. Inspection of `apps/server/src/identity/d01/identity.ts` and the existing `logout.EX09.integration.test.ts` confirmed that signout intentionally returns the former provider-adapter envelope. The test now distinguishes this established identity envelope from semantic endpoint errors. No status, privacy, pending, session, revision, receipt, retry or ordering expectation was weakened. The initial failure occurred before the later logout assertions; those assertions passed in the subsequent four-case run.

## Limits

These are executed witnesses for the specified SH-07/08 orders using OpenEvidence and public revoke/logout in distinct server processes. They do not establish all interleavings, deadline/expiry cases, ACK outages, hard process death, Inspect/retained-Frame race variants, browser/CLI races, client receipt of bytes, or full D03 acceptance. The native boundary remains return of `end`, not proof of network delivery. Unknown outcomes and orphan recovery require their separately specified proofs.
