# ZA-26 acceptance — frontier integration review

**Lane:** acceptance · **Ticket:** ZA-26

Closes the **selected** frontier on one current tip with truthful status. Not full-horizon product acceptance.

| Seam | Path | Covers |
| --- | --- | --- |
| Status + fail-closed gates | `tests/integration/frontier/frontier-status.ZA26.integration.test.ts` | ZA-26-01, ZA-26-02, ZA-26-03 |
| Machine status | `docs/verification/frontier-status.json` | Tip / lock / scopes / gates / execution |
| Human report | `docs/verification/frontier-integration.md` | Selected finance profile + blocked gates |
| Selected ICP demo | `tests/acceptance/finance/README.md` + finance browser/integration | ZA-26-01 scope only |

```bash
pnpm exec vitest run --project integration \
  tests/integration/frontier/frontier-status.ZA26.integration.test.ts
pnpm exec vitest run --project integration \
  tests/integration/finance/record-reconciliation.ZA25.integration.test.ts
ZOEN_TEST_WEB_URL=http://127.0.0.1:4310 \
pnpm test:acceptance -- apps/web/test/features/finance/finance.ZA25.browser.spec.ts
```

Honest claims: Eve / G-PROVIDER / G-STORAGE-FENCE / H-01 stay Blocked or Unknown; `textProfileAccepted` false; hosted Erased not activated; cloud speech disabled. Merge does not activate capabilities.
