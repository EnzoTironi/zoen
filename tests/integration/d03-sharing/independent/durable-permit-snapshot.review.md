# Independent durable-permit protocol review

## Executed evidence

Run `node --env-file=.env.infra tests/integration/d03-sharing/independent/durable-permit-snapshot.review.mjs` against the configured real PostgreSQL database. The script owns a randomly named schema and drops only that schema. No service/provider response is mocked. This is a SQL concurrency experiment, not product, HTTP, Better Auth, or full disclosure acceptance.

Observed on 2026-09-05:

```json
{"mode":"unsafe","stalePending":0,"actualPending":1,"state":"revoked","unsafeCommitReproduced":true}
{"mode":"existing-subject","staleSnapshotSqlstate":"40001","freshPending":1,"state":"active"}
{"mode":"absent-subject","staleSnapshotSqlstate":"40001","freshPending":1,"state":"active"}
```

The unsafe case establishes a SERIALIZABLE revoker snapshot before the reader commits a permit. The reader holds the shared advisory lock during permit insertion and physically closes its PostgreSQL connection afterward. The revoker acquires the exclusive advisory lock, sees zero permits in its old snapshot, changes membership, and commits successfully. An independent connection sees both the pending permit and revoked membership. PostgreSQL SSI does not reject this history by itself.

The two treatment cases atomically write a subject revision and insert the permit in the reader transaction. The revoker performs the same subject upsert after obtaining the exclusive lock and before inspecting permits. Its stale transaction fails with SQLSTATE 40001 both when the subject existed before its snapshot and when the subject was absent. A new transaction acquires the exclusive lock, writes the revision, sees the pending permit, and rolls back; membership stays active and the pending permit survives.

## Conditions for the proposed production protocol

- Every permit insertion must atomically update the relevant session and membership subject rows. All disclosure paths must use the same authority PostgreSQL database and subject-key derivation. A session subject write alone does not protect a membership revoker that writes another row.
- Every membership revocation must write its subject after obtaining the exclusive lock and before checking pending permits, including retries of an already-started SERIALIZABLE semantic transaction. A 40001 must restart the entire semantic transaction, not just the query/savepoint. Exhausted retries fail closed.
- A pending permit prevents successful revocation. The subject revision is a concurrency fence, not a replacement for that check. Pending permits and unknown emission outcomes must not expire by time or coordinator connection loss.
- Logout must acquire the session exclusive lock, check all pending session permits, and commit a durable session-closing barrier before external identity-provider I/O. The committed barrier must prevent new permits even if the coordinator connection subsequently disappears. This review did not execute that cross-database/provider flow.
- Permit deletion requires either positive acknowledgment that the owned private writer's `end(bytes)` returned or proof that this attempt can never emit. Generic scope closure, cancellation, an HTTP failure response, or an expired lease does not supply that proof.

## Native HTTP writer review

The installed Effect Node HTTP implementation exposes `NodeHttpServerRequest.toServerResponse(request)`. Its normal writer returns immediately when `writableEnded` is already true. A narrowly owned native helper can therefore apply headers, synchronously call `writeHead` and `end(privateBytes)`, and then return an empty framework response. The coordinator may acknowledge only successful completion of this specific helper. This conclusion is code inspection, not an executed HTTP acceptance result.

Guards and required response headers must run before invoking that helper: framework pre-response processing after it cannot change bytes already handed off. Mark emission as started before the first private-byte handoff; permit cleanup after a throw, interruption, or coordinator loss during/after invocation is unsafe without positive acknowledgment. No detached continuation or second emitter may retain these bytes. A callback that merely succeeds without invoking the trusted writer is not an acknowledgment; an opaque result from the owned writer makes that distinction explicit.

If acknowledgment persistence fails after `end(bytes)` returns, the client may already receive HTTP 200. The implementation cannot retroactively guarantee a 503. Preserve the permit; an acknowledgment retry must refer to the same completed emission attempt and must never retransmit private bytes to obtain proof. A crash before acknowledgment commit likewise leaves the durable permit pending. A never-started callback can release its permit only if the implementation also proves no future callback invocation is possible.

The SQL treatment closes the demonstrated stale-snapshot hole under the stated write discipline. It does not establish complete production integration, real socket delivery, browser behavior, logout semantics, or independent product acceptance.
