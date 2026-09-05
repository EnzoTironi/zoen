# Rivet Dynamic Apps — replaceable, qualified specialized runtime

**Decision:** first candidate adapter is `@rivet-dev/dynamic-apps-core`; declarative apps and frontend-only bundles do not require it. This is an unimplemented adapter specification, not an admitted dependency lock. Exact upstream API/behavior is probed by ZN-0314.

## Verified documentation, not assumed product proof

Primary docs reviewed on 2026-09-04 describe Core-controlled storage/loading, host-managed authentication, embedded runtime possibilities and `deployApp` successful activation. Dynamic Apps is labeled Preview; agentOS security model is beta and places host configuration in its trusted boundary. Those descriptions justify qualification requirements; they do not prove safety or compatibility. See [dated sources](../lineage/source-ledger.md).

Do not call `deployApp` on a mutable public app ID and label it preparation. The documented successful call activates that runtime's release. Our adapter must map it to a private **immutable internal slot**, while Ontology alone controls which approved artifact the public logical app resolves. Do not invent unsupported `dryRun`/`activate:false` flags.

## Zoen-owned port, not fictitious vendor functions

```text
PrepareRuntime(artifactRef, expectedDigest, profileRef, realm, partition)
  -> PreparedRuntime | BuildFailed | Blocked | Unknown
ProbeRuntime(preparationRef, EvaluationWorld)
  -> RuntimeAttestation | Failed
ResolvePreparedRuntime(publicationBinding, currentAppSession)
  -> IsolatedTarget | Denied | Unavailable
RetireRuntime(slotRef, currentRetentionProof)
  -> Retired | StillPinned | Unknown
```

These are our contracts. The implementation maps them to the actual admitted Core API/hook set. If the API cannot enforce immutable slot identity, private route ownership, state partition, recovery or protected bootstrap, the candidate fails admission; choose a reviewed replacement without changing the product's semantic path.

## Build, stage, activate, serve

1. Build a full dependency-locked artifact in isolated CI, with no production data, source credentials or secret-bearing mounts. Validate install scripts, supply-chain provenance, bundle content and signature. Requests for runtime capabilities are data for review, not automatically merged permissions.
2. Allocate an internal immutable preparation/slot identity binding artifact, profile, realm and private state partition. A given identity may never be overwritten with another digest. Before successful preparation, repeated same-intent build failures can be retried under the same staging job; no public reference exists yet.
3. Deploy into a nonpublic controlled runtime; disable automatic production namespace/secret provisioning. Internal activation is expected and irrelevant to public authority. Unknown deployment result is reconciled by exact slot/digest probe before further mutation.
4. Evaluate with branded EvaluationWorld inputs and channel sinks. Record runtime/profile/digest proof. Evaluation and live slot namespaces are separate; production credentials cannot be copied for a smoke test.
5. Join runtime proof to ordinary release preparation and old-policy approval. An atomic Ontology head transition publishes the AppPublicationBinding. No distributed ACID is claimed: immutable staging precedes one local authoritative pointer change, and unreferenced slots are cleaned later.
6. A current AppSession resolves the exact approved binding. Public host never follows Rivet latest/app alias. Cache invalidation is an optimization; a cold/expired cache must revalidate the binding and current recall state or fail closed. Active form versions do not hot-swap.
7. Route through the trusted app host. Protected frontend assets are fetched/authorized by that host and passed to an isolated generic loader; a runtime slot URL is never the user-facing protected link. Backend data calls use the same SemanticClient and actor/session restrictions.

## State, topology and blast radius

Runtime host is in the admitted runner plane with external containment, distinct network/role from authority. A shared image or code digest does not justify shared private process state. A mutable backend instance is partitioned by the full current session/lease context. Stateless public bundles may be reused; private SQLite, actor globals and restored snapshots cannot cross subjects/purposes.

Rivet capabilities such as state or scheduling, where available, may serve non-authoritative computation under the existing lease/Mandate. They do not become Zoen's journal, release registry, source truth, outbox or settlement record. Scheduled/background work cannot cache a human's expired session.

## Failure and recovery table

| Boundary | Required outcome |
|---|---|
| Build fails | Active Zoen binding unchanged; bounded diagnostics contain no secrets |
| Runtime deploy success, proof write lost | Reconcile exact internal slot; candidate remains nonpublic |
| Approval revoked after prepare | No activation; slot retained/cleaned by policy |
| Head/meaning changes | PreparationStale/rebase; no blind public pointer overwrite |
| Published slot temporarily unavailable | Unavailable; no vendor-latest fallback |
| Runtime cache is stale | Revalidate current binding/recall or deny; never serve newly unauthorized version |
| Guest action response lost | Core operation identity prevents duplicate local intent; external outcome remains separately reconciled |
| Artifact recalled | Deny new resolutions and calls; close owned sessions even if VM remains warm |
| Garbage collection races active session | Retention proof/pin prevents destroying needed admitted artifact |
| Restore old runtime snapshot | Recheck epoch, session/lease, digest and recall; do not restore authority |

## Admission

ZN-0314..0319 require real package/Core probes, isolation limits, browser-host integration, hostile input, publication races, warm-state partition, recovery and measured limits. This workspace does not use mock runtime adapters; pure contract validation does not substitute actual Core/runner evidence and cannot satisfy G-RIVET-DYNAMIC. Production remains disabled until exact evidence is accepted.

The final intended specialized profile must either qualify this candidate or follow an explicit ADR replacement and requalification. Failure does not block independently admitted declarative apps or trusted-renderer output. It does block claims that this particular runtime is ready. We did not call the Rivet API, install its runtime, provision a namespace or run a real probe in preparing this bundle.
