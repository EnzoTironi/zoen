# Independent EX23 Web review

Reviewed candidate `956998c` (W1), with the frozen `docs/contracts/sharing.md` and the equivalent CLI command builder. The runtime baseline is root build `4e26895`, isolated `sharing-baseline` profile at `http://127.0.0.1:4314`; no deployment or release acceptance is implied.

## WEB-01 — confirmed: denial is ignored while another request is busy

`apps/web/src/features/worlds/state.ts`, `revalidateContent`, checks `state.busy` before examining the returned access failure. The UI can therefore receive a real `NotFoundOrDenied` and retain the World, Frame and source data. An earlier response that the server legitimately emitted before revocation can also populate the evidence panel afterward because the denial did not invalidate the controller epoch.

Independent real-browser reproduction on 2026-09-05 at 17:46 America/Sao_Paulo:

1. Create two ordinary Better Auth accounts, a World and evidence through the real public API, then grant viewer access.
2. Open the World and Inspect in the real browser. Hold the next periodic own-access request before sending it.
3. Start OpenEvidence through the UI. Capture its actual HTTP 200 using `route.fetch`, retaining the original status, headers and body and delaying only delivery.
4. Confirm a real semantic revoke through the owner API. Release the access request: the real server returns HTTP 404 with exactly `NotFoundOrDenied`.
5. While OpenEvidence remains busy, the World remains displayed. Release its original successful response: the evidence document appears after the received denial.

The unchanged clear-on-denial assertion failed: `.worlds-world-id` expected 0, received 1, both immediately after denial and after delayed success. The browser test failed in 7.6 seconds. It does not claim that the server emitted bytes after a confirmed revoke: the successful response was emitted earlier. The defect is client handling of the denial and an already emitted response.

Preserved local artifacts under `/Users/enzotironi/zoen-ex03/test-results/acceptance-1788641183328/integration-sharing-in-06a21-es-the-delayed-real-success-chromium/`: `error-context.md`, `test-failed-1.png`, `test-failed-2.png`. Independent visual inspection of the second screenshot confirms the source label, amount `712.45 BRL`, Frame reference and evidence JSON remain visible. The synthetic data fed real services; no provider or executor response was fabricated.

The initial late-success assertion could observe absence before the delivered response rendered; the independent reviewer will tighten that observation without changing its expected outcome. The World-retention failures and screenshot already reproduce the defect. W1 was informed after baseline capture and owns the correction.

## Source review completed; remaining runtime checks

- The public browser client dispatches all three sharing operations to the same typed semantic HTTP family. Roles only control presentation.
- Owner confirmation displays exact recipient UUID, World, inspected revision/absence, whole-World existing/future audience and the retained-copy limit. No directory, invite or deletion operation is added.
- Viewer presentation hides import, correction and sharing management and retains Inspect, own historical Frame and OpenEvidence.
- Mutation retry retains the request object; `Stale` clears the target/confirmation and requires a new inspection and confirmation. These paths need the independent live race test below before being counted as runtime proof.
- Receipt presentation is explicitly historical; the controller requests fresh InspectWorldAccess after mutation success. Delayed receipt/replay after revoke remains to be exercised independently.
- Session/World invalidation aborts active effects, advances epoch and clears Frame, view, proposal, sharing target and receipt. The confirmed busy-response exception above prevents calling this complete.

This review does not accept the backend disclosure fence, D03 erasure/restore, or the full product. The EX23 packet command could not run in this reconstruction worktree because `tooling/workspace.py` is absent; review authority came from the explicit root assignment and the frozen contract, not historical planning files.

## WEB-01 treatment and live revision/replay proof

Root served build `a236ebb`, Web `4198f01` (W1 `4ace1e4`), at isolated profile `http://127.0.0.1:4315`. The same denial assertion now passes. The late-success check was strengthened to wait until the real buffered delivery finishes and the browser reaches either an invalidated World or rendered evidence, then require absence of both the World and evidence. Both independent scenarios passed in 26.8 seconds on 2026-09-05 around 17:52:

- Busy-denial treatment: real 404 invalidates the epoch immediately and the earlier real 200 cannot repopulate the evidence.
- Revision/replay: a real external grant makes the UI's confirmed absence stale. HTTP 409 Stale removes target, confirmation and retry; a fresh inspection plus explicit new confirmation sends a different operation ID and exact revision 0. While its real grant response is held, a real revoke commits. Replaying the exact grant request returns its original receipt without changing revoked revision 1. Delivering the original response makes the UI query fresh current access and display revoked revision 1, with the receipt expressly labeled historical.

The latter scenario also passed on uncorrected `956998c` at 4314 in 11.5 seconds. Seven W1 request/render unit tests were independently rerun and passed; their synthetic component inputs are not counted as live transport evidence.

## WEB-02 — confirmed: a late denial is ignored after the displayed Frame changes

The historical Frame branch in `revalidateContent` has the same ordering problem: it compares `state.frame?.frameRef` with the requested Frame before processing `Result.isFailure(revalidated)`. A new Frame in the same World/session/epoch is not a reason to ignore an actual denial.

Independent baseline against `956998c`/4314 on 2026-09-05 around 17:53:

1. An authenticated viewer opens and inspects real imported evidence.
2. Hold the normal periodic historical Inspect request before it reaches the server; membership refresh has already succeeded.
3. Complete a fresh UI Inspect. Its real successful response contains a different Frame reference, and the browser displays it.
4. Commit real owner revoke, then release the earlier historical Inspect. The server returns the exact HTTP 404 NotFoundOrDenied body.
5. Require immediate absence of the World and its private source/evidence control. Both checks fail: expected 0, received 1.

The test failed in 18.0 seconds. Artifacts remain under `/Users/enzotironi/zoen-ex03/test-results/acceptance-1788641583749/integration-sharing-in-3098d-wer-Frame-in-the-same-World-chromium/` (`error-context.md`, both screenshots). W1 received the reproducible finding and owns the correction; no production source was edited by the reviewer.

An earlier attempt against 4315 stopped at a real signup HTTP 429 while root's acceptance suite authenticated concurrently. It never reached the Frame test and is not counted as product evidence. The provider guard was not changed; the completed baseline used the separate 4314 profile.

Review checkpoint before the final treatment: WEB-01 fixed and independently verified; Stale/replay flow verified; WEB-02 awaited correction and independent treatment. Source-level session/World discard paths remain subject to that unresolved denial path. These findings do not alter the backend fence contract or establish D03 erasure/restore acceptance.

## Final independent treatment — both findings resolved

On 2026-09-05 around 17:57, root served complete treatment build `767f757` at `http://127.0.0.1:4316`, isolated `sharing-v2` profile. It includes W1's busy-denial correction (`4ace1e4`, integrated as `4198f01`), prior-Frame denial correction (`1485ea6`, integrated as `767f757`) and retained denial heading (`392178d`, integrated as `0447a4e`). The reviewer read the two state changes: session/World epoch and disposal guards remain; transient busy or Frame-reference changes cannot suppress a same-context failure. The historical-read branch does not publish successful responses, so no Frame-reference success guard is needed there.

Command, using Node 24.18.1 and the unchanged assertions from the independently owned test file:

```sh
ZOEN_TEST_SHARING_WEB_URL=http://127.0.0.1:4316 pnpm exec playwright test --config playwright.acceptance.config.ts apps/web/test/integration/sharing/independent/web-race.review.browser.spec.ts
```

All three passed, 42.8 seconds total:

| Independent scenario | Result |
| --- | --- |
| Real denial while earlier evidence response is busy; deliver the unchanged earlier HTTP 200 | PASS, 15.7s. World and private evidence are discarded and do not reappear. |
| Real Stale, new explicit confirmation, identical historical grant replay after revoke, fresh current inspection | PASS, 10.8s. New operation ID and exact revision are required; UI shows revoked revision 1, not historical active revision 0. |
| Real denial of an earlier retained Frame after a different current Frame has rendered | PASS, 15.7s. World and private source controls are discarded. |

The source and tests remain in the independent commit history (`09daaae`, `b4b74bf`); both failing baselines and screenshots above remain preserved. The reviewer did not modify W1's production source, substitute an executor/provider, relax expected outcomes, or disable provider guards. Targeted lint and the global TypeScript check for the independent test worktree passed.

CLI equivalence was reviewed in `apps/cli/src/sharing/command.ts`: explicit recipient UUID, required operation ID and revision, literal `null` only for absent grant targets, and separate current inspection are the same semantic intent as the browser's confirmed request. The browser generates an ID only at explicit confirmation and retains the request for retry; the CLI requires the caller to retain all arguments. Both distinguish historical receipts from current access.

Session/context source review confirms that principal **and session ID**, World switches, page hiding/restoration and same-origin broadcast invalidation discard ephemeral state and abort older effects. Owner management and private correction controls are not rendered for viewers; the server remains the authority for every operation. No additional runtime session-switch test was added because this review's distinct proof concerns the two newly found same-context denial races and revision/replay flow; root's broader session/browser regression suite remains separate evidence.

Final disposition: no open findings in this reviewed Web EX23 scope after independent treatment. This is not a backend fence certificate, deployment approval, full D03 acceptance, or proof of erasure/restore. Root retains the broader integration and activation gates.

## CI busy-guard flake on owner revoke (tip `419ea90`)

Container acceptance on [CI run 34049794018](https://github.com/EnzoTironi/zoen/actions/runs/34049794018) failed only the third race scenario when owner `RevokeWorldReadAccess` returned HTTP 503 Unavailable immediately after the viewer's fresh Inspect 200. That envelope is the documented membership mutator refusal while `jobs.disclosure_pending` still holds the viewer's membership key (ACK window after emission). Identity Stale-flag scoping did not participate: the failure was API-side before denial delivery. The harness `send()` helper now retries the same operationId/intention on Unavailable, matching disclosure busy semantics; expected denial outcomes are unchanged.
