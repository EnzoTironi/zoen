# Independent EX23 Web review

Reviewed candidate `956998c` (W1), with the frozen `docs/contracts/d03-sharing.md` and the equivalent CLI command builder. The runtime baseline is root build `4e26895`, isolated `sharing-baseline` profile at `http://127.0.0.1:4314`; no deployment or release acceptance is implied.

## WEB-01 — confirmed: denial is ignored while another request is busy

`apps/web/src/features/d01/state.ts`, `revalidateContent`, checks `state.busy` before examining the returned access failure. The UI can therefore receive a real `NotFoundOrDenied` and retain the World, Frame and source data. An earlier response that the server legitimately emitted before revocation can also populate the evidence panel afterward because the denial did not invalidate the controller epoch.

Independent real-browser reproduction on 2026-09-05 at 17:46 America/Sao_Paulo:

1. Create two ordinary Better Auth accounts, a World and evidence through the real public API, then grant viewer access.
2. Open the World and Inspect in the real browser. Hold the next periodic own-access request before sending it.
3. Start OpenEvidence through the UI. Capture its actual HTTP 200 using `route.fetch`, retaining the original status, headers and body and delaying only delivery.
4. Confirm a real semantic revoke through the owner API. Release the access request: the real server returns HTTP 404 with exactly `NotFoundOrDenied`.
5. While OpenEvidence remains busy, the World remains displayed. Release its original successful response: the evidence document appears after the received denial.

The unchanged clear-on-denial assertion failed: `.d01-world-id` expected 0, received 1, both immediately after denial and after delayed success. The browser test failed in 7.6 seconds. It does not claim that the server emitted bytes after a confirmed revoke: the successful response was emitted earlier. The defect is client handling of the denial and an already emitted response.

Preserved local artifacts under `/Users/enzotironi/zoen-ex03/test-results/acceptance-1788641183328/integration-d03-sharing-in-06a21-es-the-delayed-real-success-chromium/`: `error-context.md`, `test-failed-1.png`, `test-failed-2.png`. Independent visual inspection of the second screenshot confirms the source label, amount `712.45 BRL`, Frame reference and evidence JSON remain visible. The synthetic data fed real services; no provider or executor response was fabricated.

The initial late-success assertion could observe absence before the delivered response rendered; the independent reviewer will tighten that observation without changing its expected outcome. The World-retention failures and screenshot already reproduce the defect. W1 was informed after baseline capture and owns the correction.

## Source review completed; remaining runtime checks

- The public browser client dispatches all three sharing operations to the same typed semantic HTTP family. Roles only control presentation.
- Owner confirmation displays exact recipient UUID, World, inspected revision/absence, whole-World existing/future audience and the retained-copy limit. No directory, invite or deletion operation is added.
- Viewer presentation hides import, correction and sharing management and retains Inspect, own historical Frame and OpenEvidence.
- Mutation retry retains the request object; `Stale` clears the target/confirmation and requires a new inspection and confirmation. These paths need the independent live race test below before being counted as runtime proof.
- Receipt presentation is explicitly historical; the controller requests fresh InspectWorldAccess after mutation success. Delayed receipt/replay after revoke remains to be exercised independently.
- Session/World invalidation aborts active effects, advances epoch and clears Frame, view, proposal, sharing target and receipt. The confirmed busy-response exception above prevents calling this complete.

This review does not accept the backend disclosure fence, D03 erasure/restore, or the full product. The EX23 packet command could not run in this reconstruction worktree because `tooling/workspace.py` is absent; review authority came from the explicit root assignment and the frozen contract, not historical planning files.
