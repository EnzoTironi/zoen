# Normative state machines — v4

States specify product behavior, not an implemented engine. V4 adds links, challenges, app sessions and non-authoritative runtime preparation; publication reuses the existing release machine.

## ActionCase

Owner: Ontology. Initial: `proposed`.

open = proposed, awaiting-approval, approved, blocked. Terminal Cases never reopen; changes produce new Cases. Cancelling a committed action is a new compensating action, not history rewrite.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| proposed | request-approval | awaiting-approval | Released action, complete consequences and read guards | Pin Case digest/expiry and approval requirements |
| awaiting-approval | record-approval | awaiting-approval | Fresh authorized responder; quorum incomplete | Record response; return CaseProgress, no decision commit |
| awaiting-approval | satisfy-quorum | approved | Exact Case digest; current approval policy | Record final response and approval state |
| approved | commit | committed | Current authority, head/complete read guards, budget and expiry valid | One DecisionReceipt, semantic changes, reservations, EffectIntents and outbox |
| approved | resource-unavailable | blocked | No external effect escaped; required resource unavailable | Record nonterminal cause; no effect dispatch |
| blocked | resume | approved | Same consent and all dependencies remain valid | Clear temporary block; otherwise return stale |
| *open | dependency-change | stale | Relevant guard no longer valid | Terminalize consent; require a new Case |
| *open | reject | rejected | Authorized approver rejects under policy | Record rejection, release unescaped reservations |
| *open | expire | expired | Bound clock exceeds expiry | No commit; expire unescaped preparation |
| *open | cancel | cancelled | Authorized cancellation before local commit | Record cancellation; no escaped-effect claim |

## EveTurn

Owner: Eve. Initial: `admitted`.

open excludes settled/aborted. Token inference may repeat after failure; exactly one settled turn is enforced, not exactly-once model inference. Do not store private chain-of-thought.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| admitted | claim | running | Owner lease/fence acquired | Record owner token, fence and attempt |
| running | tool-proposal | waiting-tool | Released inspect/propose tool; authority checked independently | Persist tool intent/operation ID before invocation |
| waiting-tool | observe-result | running | Same tool operation; current turn fence | Record authorized result reference once |
| running | ask | waiting-user | Question bound to subject/scope; fresh disclosure | Settle visible question fragment and wait binding |
| waiting-user | reply | running | Valid reply binding; new current fence | Admit attributed reply; no implicit global correction |
| running | recoverable-failure | retryable | No settled terminal response | Record recoverable attempt and checkpoint |
| retryable | claim | running | New owner fence | Resume from journal without duplicate committed tool operation |
| running | settle | settled | Fence current; final authorized content ready | One settled visible response and delivery intent |
| *open | abort | aborted | User cancellation/security deny | Stop future composition/tools; retain lawful history |

## DefinitionChange

Owner: Ontology. Initial: `draft`.

open excludes activated/rejected/stale. A live forward repair is another change; no blind head reversal. For supported lower-risk changes approval policy may pre-authorize, but current policy still controls it.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| draft | validate | validated | Closed grammar, references, limits and current-policy risk classification pass | Pin canonical candidate digest |
| validated | evaluate | evaluated | Exact candidate/image in isolated evaluation realm | Record proof checks and missing attestations honestly |
| evaluated | prepare | prepared | Target World generation ready through exact committed cut | Pin prepared generation and open-work disposition |
| prepared | approve | approved | Approvers authorized under currently active policy | Record digest-bound approval |
| approved | activate | activated | Exclusive head lock; exact expected head/cut; all proof/approval gates | Switch head/generation atomically; receipt and outbox |
| *open | reject | rejected | Authorized explicit rejection | Retain candidate/proof history; no activation |
| *open | basis-changed | stale | Digest/head/cut/proof no longer matches | Block activation; new preparation/review required |
| stale | rebase | draft | New change revision, conflict review | Create successor candidate; old proof remains immutable |

## SourceCapture

Owner: Ontology. Initial: `staging`.

Re-admission of identical source/mapping returns same authorized receipt. Missing rows after a failed fetch are not source deletions.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| staging | verify-upload | staged | Durable bytes, digest, declared limits and rights metadata | Record immutable capture identity |
| staging | reject-upload | quarantined | Incomplete/unsafe/unsupported bytes | Record reason, no claims |
| staged | admit | admitted | Current binding/mapping/rights and unique source revision | Evidence, claims, receipt and outbox commit together |
| staged | reject-mapping | quarantined | Schema drift or incomparable source interpretation | Keep raw attribution; no guessed facts |
| staged | expire-orphan | expired | No evidence/pin/pending admission and expired upload lease | Garbage collect with lock/recheck |
| admitted | erase | erased | Current retention/hold/deletion policy and authorized receipt | Suppress content and derivatives; retain permitted non-content audit |

## EffectAttempt

Owner: Ontology evidence; external system outcome. Initial: `prepared`.

An acceptance observation is not final financial settlement. Later corrections append evidence and derive a new view; do not overwrite observations. Any retry depends on the provider-qualified idempotency protocol and the same intent. There is deliberately no generic unknown→dispatch transition.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| prepared | dispatch | dispatching | Current narrow permit, stable provider identity, owner fence | Record dispatch-intent boundary before provider call |
| prepared | cancel | cancelled-before-dispatch | No dispatch could have escaped | Record safe local cancellation |
| dispatching | lose-reply | unknown | Provider may have accepted | Keep exposure/reservation; schedule safe observation, not blind unsafe resend |
| dispatching | observe-acceptance | observed-accepted | Verified provider evidence correlates exact intent | Append external observation |
| dispatching | observe-rejection | observed-rejected | Definitive verified nonacceptance | Append rejection; downstream reservation rules apply |
| unknown | reconcile-acceptance | observed-accepted | Independent exact correlated provider evidence | Append reconciliation observation |
| unknown | reconcile-rejection | observed-rejected | Definitive exact correlated evidence | Append reconciliation observation |

## Mandate

Owner: Ontology. Initial: `active`.

open=active,paused,blocked. Separate outcome axis: pending|achieved|failed|unknown|stopped. A sent message cannot imply an achieved business goal.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| active | temporary-block | blocked | Budget/source/policy/outcome observation missing | Record cause; no unbounded action loop |
| blocked | resume | active | Fresh scope/authority/budget/goal basis | New steps still require released actions |
| active | pause | paused | Authorized user/policy request | Stop new work; escaped effects remain tracked |
| paused | resume | active | Fresh mandate authority and nonexpired limits | Resume bounded planning |
| *open | stop | stopped | User/emergency deny | No new step; reconcile escaped effects |
| *open | deadline | expired | Bound clock past deadline | Stop new steps; preserve observed outcome |
| active | observe-goal | complete | Released outcome detector has permitted evidence | Record goal observation independently of task completion |

## DatasetPublication

Owner: Ontology + physical data ports. Initial: `staged`.

unpublished=staged,validated,pinned. Physical write and PostgreSQL commit are not cross-system ACID. Published erasure/retention is a new governed lifecycle operation, not catalog-head substitution.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| staged | validate | validated | Exact metadata/schema/rights/quality checks | Record immutable quality report |
| validated | pin | pinned | Verified physical snapshot/file retention supports required lifetime | Persist pin proof before authority publication |
| pinned | publish | published | Authority transaction verifies exact version set/head/basis | One authoritative snapshot-set receipt and outbox |
| *unpublished | reject | rejected | Invalid data or unsupported reader/writer profile | Never become authoritative |
| *unpublished | abandon | abandoned | No authority/pending pin reference; cleanup policy | Collect only safely unreferenced staging |

## CellMove

Owner: Ontology platform. Initial: `planned`.

unpromoted=planned,copied,source-fenced,destination-verified,blocked. Directory changes alone do not fence old writers. Recovery after source fence requires another proved disposition; never simply toggle both writable.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| planned | copy | copied | Destination read-only; stable source cut and catchup log | Record copy evidence; source stays sole writer |
| copied | fence-source | source-fenced | Actual source fence receipt or independently verified infrastructure fencing | Stop source writes/effects for epoch; pin final cut |
| source-fenced | verify-destination | destination-verified | Restore suppression, final cut and escaped effects reconciled | Record activation readiness at new epoch |
| destination-verified | promote | promoted | Directory CAS and destination authority admission tied to source fence | Admit one destination writer with new epoch |
| *unpromoted | unsafe-or-incomplete | blocked | Required source fencing or data proof absent | No destination write admission |
| *unpromoted | abort | aborted | Explicit safe source/destination disposition | No silent source reactivation after promotion |

## ContinuationRef

Owner: Ontology. Initial: `active`.

Reference possession confers no authority. Sharing/invitation acceptance are separate governed operations. Terminal refs never auto-revive.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| active | GET-or-HEAD | active | No authenticated target disclosure | No state mutation; generic landing only |
| active | authorized-open | active | Verified current recipient/session/target rights | Create scoped AppSession through same semantic operation |
| active | revoke | revoked | Current authorized revoker and operation identity | Receipt and deny new opens; invalidate derived sessions |
| active | expiry | expired | Current time reaches configured expiry | Deny new opens/refresh; terminate derived sessions by policy |

## BrowserContinuationChallenge

Owner: Door. Initial: `pending`.

A forwarded URL/OTP by itself is not binding. Failed/expired challenges require a new challenge; active domain authority is never stored in the challenge.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| pending | preview | pending | Unauthenticated GET/HEAD | No challenge consume or protected disclosure |
| pending | exchange | redeemed | POST; CSRF; exact Origin; bound browser; verified recipient; current target admission | Consume once atomically, rotate session and issue target session |
| pending | bad-proof | pending | Attempts below limit | Increment attempt count only |
| pending | attempt-limit | locked | Max attempts reached | Deny further redemption |
| pending | expiry | expired | Challenge deadline reached | Deny redemption |

## AppSession

Owner: Ontology. Initial: `active`.

Terminal session cannot be refreshed into active. New session requires current authority. Already disclosed/network-in-flight bytes are not retractable.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| active | semantic-call | active | Current rights, purpose, app ceiling, source rights, publication and recall valid | Invoke existing semantic executor; no session-local policy |
| active | compatible-refresh | active | New authorized Frame; unchanged action semantics; current authority | Update view/session revision without inheriting old rights |
| active | incompatible-publication | contract-changed | Meaning/schema/action contract no longer compatible | Block pending operation; require new session/intent |
| active | logout | closed | Subject or authorized host logout | Cancel owned work and clear controlled cache |
| active | revoke | revoked | Membership/link/installation/security deny | Block future disclosure/operations, close queues |
| active | expiry | expired | Idle/absolute session bound reached | Deny refresh/calls until new authenticated open |

## AppRuntimePreparation

Owner: Jobs; not domain authority. Initial: `staging`.

No active/public state here. App publication is an existing DefinitionChange/head transition. Unknown cannot be blindly retried; a runtime internal deploy may already have activated its private slot.

| From | Event | To | Guard | Atomic effect |
|---|---|---|---|---|
| staging | probe-success | prepared | Exact immutable artifact/profile/realm/partition verified | Record nonpublic runtime attestation |
| staging | build-fail | failed | Observed bounded build failure | Record diagnostic; active Ontology binding unchanged |
| staging | lost-reply | unknown | Runtime may have accepted slot; outcome not observed | Record need for exact slot reconciliation |
| unknown | probe-success | prepared | Observed same slot/digest/profile | Record attestation, still nonpublic |
| unknown | probe-rejection | failed | Explicit observed rejection/no successful stage | Record failure, no invented rollback |
| prepared | retire | retired | No active/evaluation/session retention pin and current cleanup fence | Retire only nonrequired slot; no change to domain receipts |
| failed | cleanup | retired | No pins/leases and authorized cleanup | Clean staging bytes |
| prepared | retain-for-publication | prepared | Existing release process separately approves binding | No local activation authority added |
