# ZA-25 acceptance — finance record reconciliation

**ICP:** finanças / personal or small-business finance · **Ticket:** ZA-25

Automated proofs for this ticket:

| Seam | Path | Covers |
| --- | --- | --- |
| Unit (selection / amount law) | `packages/ontology/test/knowledge/selection.ZA25.test.ts` | ZA-25-01 contested comparable; ZA-25-02 currency / recognition≠settlement |
| Integration (PG + S3) | `tests/integration/finance/record-reconciliation.ZA25.integration.test.ts` | ZA-25-01, ZA-25-02, ZA-25-03 (stale/conflict/replay; no fabricated receipt) |
| Browser + CLI | `apps/web/test/features/finance/finance.ZA25.browser.spec.ts` | ZA-25-01 contested inspection, CLI parity, correction, and undo |

Run against a real disposable compose (PostgreSQL + object storage) and a normal account. No test-defined interpretation or permission booleans.

```bash
pnpm test:unit -- packages/ontology/test/knowledge/selection.ZA25.test.ts
pnpm test:integration -- tests/integration/finance/record-reconciliation.ZA25.integration.test.ts
ZOEN_TEST_WEB_URL=http://127.0.0.1:4310 \
pnpm test:acceptance -- apps/web/test/features/finance/finance.ZA25.browser.spec.ts
```

Product narrative and example lists: [docs/product/finance-record-reconciliation.md](../../../docs/product/finance-record-reconciliation.md).
