# Fault injection matrix — v4

Product execution required at each boundary; none has run in this package. Test-only barriers must not appear as production endpoints.

| ID | Boundary | Barrier | Injection | Oracle | Spec |
|---|---|---|---|---|---|
| F-01 | Authority commit | after guard check, before SQL commit | SIGKILL real authority process | No partial semantic state/receipt/outbox | [SPEC-003](../specs/spec-003.md) |
| F-02 | Authority reply | after commit, before client reply | Drop connection; retry same and changed intent | Same receipt once; changed intent conflict; replay rights renewed | [SPEC-003](../specs/spec-003.md) |
| F-03 | Predicate read | after approval, before new matching insert | Race real serializable connections | Stale Case despite unchanged visible row versions | [SPEC-003](../specs/spec-003.md) |
| F-04 | Capture admission | after object durable, before evidence commit | Kill process; race cleanup | Orphan collectible only without pending/pin; no missing admitted bytes | [SPEC-004](../specs/spec-004.md) |
| F-05 | Turn settlement | after visible partial output, before settle | Kill/reclaim with old fence | At most one settled reply; no duplicate committed tool operation | [SPEC-009](../specs/spec-009.md) |
| F-06 | Channel ingress | after inbox/outbox commit, before ACK | Provider redelivery and process restart | One admitted inbound message; valid retry safe | [SPEC-011](../specs/spec-011.md) |
| F-07 | Delayed notice | after arbitration, before composition | Revoke source/member permission | Suppress/redact with freshly authorized view | [SPEC-020](../specs/spec-020.md) |
| F-08 | Release activation | after preparation, before head lock | Concurrent evidence and policy change | PreparationStale; no mixed generation | [SPEC-014](../specs/spec-014.md) |
| F-09 | External effect | provider accepts, reply lost | Timeout then repeated durable job | Unknown preserved; no blind unsafe resend | [SPEC-023](../specs/spec-023.md) |
| F-10 | Cancellation | cancel requested while provider accepts | Reorder acceptance/cancel callbacks | Local stop separate from escaped outcome | [SPEC-023](../specs/spec-023.md) |
| F-11 | Budget children | two reservation requests concurrently | Real SQL race, 70+70 against100 | At most one 70 accepted; total ≤100 | [SPEC-024](../specs/spec-024.md) |
| F-12 | Runner boundary | before secret/network/output access | Actual guest host/metadata/egress probe | Denied by infrastructure/broker, not merely guest convention | [SPEC-030](../specs/spec-030.md) |
| F-13 | Snapshot publication | after pin before PG publication | Catalog GC and process kill | No published missing snapshot; no mixed version set | [SPEC-031](../specs/spec-031.md) |
| F-14 | Stream coverage | after checkpoint, before source gap recovery | Duplicate/out-of-order/missing events | Coverage gap explicit; no destructive inferred empty state | [SPEC-032](../specs/spec-032.md) |
| F-15 | Live observation | between displayed and approved price | Feed changes and entitlement expires | Exact capture or stale/denied; no latest-value substitution | [SPEC-033](../specs/spec-033.md) |
| F-16 | Erase and restore | old backup includes erased artifact | Restore full cell in isolated environment | Suppression ledger applied before any disclosure or effects | [SPEC-039](../specs/spec-039.md) |
| F-17 | Cell migration | directory CAS while source unreachable | Partition without independent source fence | No new writable primary | [SPEC-042](../specs/spec-042.md) |
| F-18 | Federated action | one local commit, other rejects | Partial remote failure | Independent receipts, explicit partial compensation options | [SPEC-043](../specs/spec-043.md) |
| F-19 | Offline lease | after lease expiry before sync | Reconnect stale edge and replay actions | No revived authority; pending local claims reviewed normally | [SPEC-044](../specs/spec-044.md) |
| F-20 | Financial lifecycle | fill/bust/cancel/allocation callbacks | Duplicate and permute verified broker events | Quantity conservation, no inferred custody settlement | [SPEC-047](../specs/spec-047.md) |
| F-21 | Hidden evidence | before ranking/context generation | Paired World differs only in forbidden rival | Equivalent permitted content/counts/confidence/errors | [SPEC-025](../specs/spec-025.md) |
| F-22 | Source ACL | permission revocation between polls | Expired entitlement without complete delta | Fail-closed coverage and no stale disclosure | [SPEC-041](../specs/spec-041.md) |
| F-23 | Human correction | after wrong scoped reply then undo | Replay prior question and correction IDs | History preserved, no global rule installation | [SPEC-017](../specs/spec-017.md) |
| F-24 | Supply-chain promotion | after signed build, changed dependency | Tamper image/manifest or current lock | Admission denies mismatched provenance | [SPEC-029](../specs/spec-029.md) |
| F-25 | Link challenge | before POST redemption | Race copied browser proofs and preview fetches | Only bound authenticated POST may consume once; previews never consume | [SPEC-051](../specs/spec-051.md) |
| F-26 | App disclosure | before final authorization/send | Commit revocation and fail auth store | No new authorized data dispatch; explicit deny/unavailable | [SPEC-051](../specs/spec-051.md) |
| F-27 | Bridge identity | after iframe navigation | Replay old source window/channel messages | No dispatch under replacement session | [SPEC-053](../specs/spec-053.md) |
| F-28 | Guest state | before warm instance reuse | Alternate owner/worker and restore snapshot | No cross-subject/purpose private state or stale grant | [SPEC-053](../specs/spec-053.md) |
| F-29 | App export | after generation before download | Revoke source rights | Download denied; handle cannot authorize | [SPEC-050](../specs/spec-050.md) |
| F-30 | Runtime staging | after internal deploy before proof write | Kill runtime host | Reconcile immutable slot; public binding unchanged | [SPEC-054](../specs/spec-054.md) |
| F-31 | Runtime publication | after prepare before activation | Revoke author or advance release head | Denied/PreparationStale; no public promotion | [SPEC-054](../specs/spec-054.md) |
| F-32 | Runtime recall | after recall before routing cache invalidation | Send request to stale host | Current recall blocks data/calls; no latest fallback | [SPEC-054](../specs/spec-054.md) |
| F-33 | App action | before authority commit | Insert predicate match and replay same ID across surfaces | Stale or one prior result as applicable; no duplicate effect | [SPEC-055](../specs/spec-055.md) |
| F-34 | Guest disclosure | before supplying protected Frame | Remove executable disclosure admission | No protected guest payload; trusted renderer/fail-closed | [SPEC-053](../specs/spec-053.md) |
| F-35 | MCP host | during resource/tool negotiation | Host omits required security capability | Text/protected-link fallback without authority leak | [SPEC-053](../specs/spec-053.md) |
| F-36 | App load | during bounded batch/fanout | Saturate workload, buffer and cancel | Explicit quota/gaps, bounded memory and no raw-source bypass | [SPEC-055](../specs/spec-055.md) |
