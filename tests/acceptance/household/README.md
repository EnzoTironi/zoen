# ZA-22 acceptance — household commitment reconciliation

**ICP:** doméstico / household · **Ticket:** ZA-22

Automated proofs for this ticket:

| Seam | Path | Covers |
| --- | --- | --- |
| Unit (selection law) | `packages/ontology/test/knowledge/selection.ZA22.test.ts` | ZA-22-02 comparable vs non-comparable |
| Integration (PG + S3) | `tests/integration/household/commitment-reconciliation.ZA22.integration.test.ts` | ZA-22-01, ZA-22-02, ZA-22-03 (including share/revoke) |
| Browser + CLI | `apps/web/test/features/household/household.ZA22.browser.spec.ts` | ZA-22-01 contested inspection, CLI parity, correction, and undo |

Run against a real disposable compose (PostgreSQL + object storage) and a normal account. No test-defined interpretation or permission booleans.

```bash
pnpm test:unit -- packages/ontology/test/knowledge/selection.ZA22.test.ts
pnpm test:integration -- tests/integration/household/commitment-reconciliation.ZA22.integration.test.ts
ZOEN_TEST_WEB_URL=http://127.0.0.1:4310 \
pnpm test:acceptance -- apps/web/test/features/household/household.ZA22.browser.spec.ts
```

Product narrative and example lists: [docs/product/household-commitments.md](../../../docs/product/household-commitments.md).
