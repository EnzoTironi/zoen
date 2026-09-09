# Frontier integration review — ZA-26

Date observed: **2026-09-09 (PT)**. Reviewed tip: `85bf4c7` (`85bf4c7a0f3c32b87ffb8eaf0d610d33801a539b`) — `#113` ZA-25 finance record reconciliation. Lockfile SHA-256: `92afa1d6a7fd27ddae857fe5d008d4e28b2ade3b23b488ebd5348ca00a8f4ef2`.

This report closes **only the selected frontier** with independent evidence on one current commit. It is **not** acceptance of the full 157-capability horizon, full D03/D04/D05, or the entire target diagram.

Machine-readable status: [`frontier-status.json`](./frontier-status.json). Selected-frontier execution report: [`frontier-execution.json`](./frontier-execution.json) (keeps `planning/validation.json` as structural `verify_plan.py` output). Validator seam: `tests/integration/frontier/frontier-status.ZA26.integration.test.ts`.

## Selected profile (ZA-25 finance)

<a id="selected-profile-za-25"></a>

| Item | Binding |
| --- | --- |
| Profile | `finance / finanças read-only record reconciliation` |
| Ticket | ZA-25 |
| Product narrative | [`docs/product/finance-record-reconciliation.md`](../product/finance-record-reconciliation.md) |
| Integration (PG + S3) | `tests/integration/finance/record-reconciliation.ZA25.integration.test.ts` |
| Browser + CLI | `apps/web/test/features/finance/finance.ZA25.browser.spec.ts` |
| Acceptance index | [`tests/acceptance/finance/README.md`](../../tests/acceptance/finance/README.md) |

Reproducible demo (normal permissions; no default mock):

```bash
pnpm exec vitest run --project integration \
  tests/integration/finance/record-reconciliation.ZA25.integration.test.ts
# With a live local server:
ZOEN_TEST_WEB_URL=http://127.0.0.1:4310 \
pnpm test:acceptance -- apps/web/test/features/finance/finance.ZA25.browser.spec.ts
```

Evidence for this profile supports **only** finance reconciliation. It does not qualify Eve product admission, hosted Erased, independent controller, cloud speech, or restore-after-erasure.

## Scope reconciliation (tip 85bf4c7)

### Implemented (code landed; not “activated by merge”)

| Scope | Notes |
| --- | --- |
| ZA-04 staging reset ownership | Local disposable resources only |
| ZA-07 exact-image admission | Policy + CI job; digest claimed only when Verify publishes it |
| ZA-08 orphaned disclosure recovery | Independent recovery seam |
| ZA-09 World Closing barrier | Real paths |
| ZA-16 feature ownership | Domain modules express ownership |
| ZA-17 Eve fail-closed | Key alone does not admit product Eve |
| ZA-22..25 ICP journeys | Household, bakery, clinic admin, finance — web/CLI + SemanticExecutor |

### Qualified (narrow profiles only)

| Scope | Limit |
| --- | --- |
| Local Closing/register | Not full D03 Erased |
| Local RustFS Object Lock | Not writer fence / hosted Erased |
| Exact-image admission policy | Per-commit artifact; no substitute digest |
| Eve Web Speech browser I/O | Cloud STT/TTS disabled |
| Narrow Eve text-profile harness | Tip keeps `textProfileAccepted: false` without G-PROVIDER |

### Blocked / Unknown (conditional gates incomplete)

| Gate / capability | Status |
| --- | --- |
| H-01 independent erasure controller | **Blocked** |
| H-02 hosted erasable target | **Blocked** |
| G-STORAGE-FENCE writer containment | **Blocked** |
| G-PROVIDER live OpenCode product | **Blocked** (key≠admission; tip `textProfileAccepted: false`) |
| G-OPS live erasable inventory | **Unknown** |
| Hosted Erased activated | **false** |
| Cloud speech | **disabled** (`CLOUD_SPEECH_ENABLED = false`) |
| `restoreAfterErasure` | **false** |
| Full D03 / D04 / D05 | **not** claimed |
| Entire target diagram implemented | **false** |

ZA-10..14 and ZA-18..21 remain **qualified or blocked per their own gates** — ZA-26 completion does **not** infer full D03/D04/D05.

## Acceptance

| ID | Outcome |
| --- | --- |
| ZA-26-01 | Selected finance profile has tip-bound demo paths + artifact evidence for that scope only |
| ZA-26-02 | Missing H-01 / G-PROVIDER / G-STORAGE-FENCE evidence → dependent capabilities stay disabled; ZA-22..25 retained |
| ZA-26-03 | Status with old commit, wrong image, or zero tests is rejected; historical cumulative counts cannot substitute |

## Image identity

Bound from tip Verify run [34365417321](https://github.com/EnzoTironi/zoen/actions/runs/34365417321) exact-image admission (not transplanted from an older tip):

| Field | Value |
| --- | --- |
| `image_id` | `sha256:f7235d494411f54b11a20a837cfa1e38c7fffc016ca5bd84ccb8eab893f26744` |
| registry digest | `sha256:8852f1df2cb4a53ae245663a018e592c6273fc2e1923dddcd0cd98bab6b7cd55` |
| reference | `ghcr.io/enzotironi/zoen/all-in-one@sha256:8852f1df2cb4a53ae245663a018e592c6273fc2e1923dddcd0cd98bab6b7cd55` |
| local tag | `zoen-all-in-one:exact-85bf4c7a0f3c` |

Public `/ready` never certifies image identity.

## Execution outcomes (implementing machine)

| Command | Result |
| --- | --- |
| `pnpm format:check` / `lint` / `typecheck` / `build` | pass |
| `pnpm test:unit` | 88 files / **473** tests pass |
| frontier ZA-26 integration | **3** pass |
| finance ZA-25 integration | **1** pass |
| finance ZA-25 browser+CLI acceptance | **1** pass |

## Out of scope

- Full 157-capability acceptance
- Automatically running Later items
- Destroying legacy Fly `zoen` or retained installs
- New platform migration
- Labeling the entire target diagram implemented
