# EX23 web candidate evidence

The candidate composes `client.sharing.execute` in the existing browser controller. It inspects the current principal's membership when creating/opening a World and during normal session refresh. The observed role only controls presentation; every request still goes to the public semantic executor.

Owner confirmation binds the exact principal UUID, World, and inspected revision (including explicit absence). A new operation ID is generated only on confirmation. Infrastructure retries retain the existing request. `Stale` discards the target and confirmation; the owner must inspect and confirm again. Mutation receipts are labeled historical and followed by a separate `InspectWorldAccess` before current access is displayed. Failure of that inspection offers retry of the inspection, not retransmission of private bytes or a new grant. Denial and session/World boundaries discard sharing data together with Frames, evidence, and correction drafts.

Viewer presentation reuses `WorldsWorkspace` with the optional `readOnly` prop, hides import and correction/management panels, and keeps inspection, evidence, and the viewer's own historical Frame input. The real authenticated session's `user.id` is shown in a read-only input for copying outside the product. No directory, email lookup, member list, invitation, or deletion operation was added.

## Executed on 2026-09-05

- Baseline: restoring only the original `WorldsWorkspace` from `c60eff8` while retaining the candidate component test made `viewer empty` fail on `expect(readonly).not.toContain('type="file"')`. The original also rendered the upload/correction invitation. Candidate source was restored in a `finally` block; no expected result was changed.
- `pnpm test:unit apps/web/test/integration/sharing apps/web/test/integration/corrections/requests.EX14.test.ts`: 10 tests in 3 files passed at 17:40:39 local time. Seven tests belong to this change; three are existing correction-request regression tests. Synthetic inputs exercise real request builders and React server rendering, not an HTTP or identity service.
- `pnpm exec tsc --noEmit`: passed across the worktree.
- Scoped `pnpm exec oxlint` over the changed components, D01/sharing features, and EX23 tests: passed without warnings or suppressions added.
- `pnpm build:web`: passed in this isolated worktree. No root build, release profile, server, or activation was run.

## Browser execution remains pending

After root has independently verified the backend and provisioned its new sharing profile:

```sh
ZOEN_TEST_SHARING_WEB_URL=http://127.0.0.1:<profile-port> pnpm exec playwright test --config playwright.acceptance.config.ts apps/web/test/integration/sharing/sharing.browser.spec.ts
```

The test requires that explicit URL with no fallback. It creates two ordinary Better Auth accounts through the UI, imports real evidence, verifies full-audience confirmation, interrupts one outgoing grant transport request without supplying a service response, checks identical retry bytes, verifies the fresh current-state query, reads the viewer's own retained Frame and exact evidence, revokes, and observes normal periodic denial remove private content. It also checks owner logout removes sharing/session identifiers. It does not prove the backend emission fence, lost-ACK commit ambiguity, or complete D03 acceptance. Browser success must be recorded only after actual execution against the integrated server.

Independent review and combined browser/adversarial checks remain root's gate. In particular, the browser contract requires a `Stale` race and historical replay after revoke to be checked independently; request/render tests do not substitute for those flows.

## Executed CLI sharing acceptance

`ZOEN_TEST_SHARING_WEB_URL=http://127.0.0.1:4314 pnpm exec playwright test --config playwright.acceptance.config.ts apps/web/test/integration/sharing/cli.browser.spec.ts` passed on 2026-09-05: one scenario, 10.1 seconds (11.2 seconds total runner). The live profile was root's `4e26895` build with real PostgreSQL/S3 and migration 006. This file uses the Playwright acceptance runner and real HTTP identity endpoints plus compiled CLI child processes; it makes no browser-rendering claim.

Three ordinary accounts were created through Better Auth HTTP and signed in using separate real CLI session directories. The recipient UUID came from its authenticated session response. The owner created a World, imported original JSON, inspected the exact target's absence and granted viewer reading with explicit UUID/operation ID/null revision. Owner and viewer claims matched; viewer `OpenEvidence` returned the original bytes, and its retained Frame was identical. Third-party reads, the owner's private Frame, viewer management and viewer import were denied with empty stdout, closed JSON stderr and exit 1.

After explicit revoke at revision 0, replaying the original grant produced exactly the original CLI output (receipt, stdout, stderr and exit status). A separate current inspection still returned revoked/revision 1, and current/history/evidence reads by the viewer were denied. A new grant with stale null expectation returned `Stale`; an explicit new grant at inspected revision 1 returned active/revision 2 and restored the viewer's own retained Frame and exact evidence. CLI sign-out removed the session and subsequent local invocation stopped at `CLI_SESSION`. No schema-flag checks were duplicated and no timeout was increased.

The test source then passed whole-worktree TypeScript and scoped lint. Its only post-run edits corrected a generic decoder type and array destructuring; assertions and operations remained unchanged. Temporary CLI session directories were removed; server-side account and authority history was preserved. The server's concurrency fence and the separately reproduced Web UI race remain independent evidence.
