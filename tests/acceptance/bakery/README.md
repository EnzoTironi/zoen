# ZA-23 acceptance — bakery order reconciliation

**ICP:** confeitaria / bakery · **Ticket:** ZA-23

Automated proofs for this ticket:

| Seam | Path | Covers |
| --- | --- | --- |
| Unit (selection / amount law) | `packages/ontology/test/knowledge/selection.ZA23.test.ts` | ZA-23-01 contested orders; ZA-23-02 grams not coerced |
| Integration (PG + S3) | `tests/integration/bakery/order-reconciliation.ZA23.integration.test.ts` | ZA-23-01, ZA-23-02, ZA-23-03 (stale consent, hidden viewer context, revoke) |
| Browser + CLI | `apps/web/test/features/bakery/bakery.ZA23.browser.spec.ts` | ZA-23-01 contested inspection, CLI parity, correction, and undo |

Run against a real disposable compose (PostgreSQL + object storage) and a normal account. No test-defined interpretation or permission booleans.

```bash
pnpm test:unit -- packages/ontology/test/knowledge/selection.ZA23.test.ts
pnpm test:integration -- tests/integration/bakery/order-reconciliation.ZA23.integration.test.ts
ZOEN_TEST_WEB_URL=http://127.0.0.1:4310 \
pnpm test:acceptance -- apps/web/test/features/bakery/bakery.ZA23.browser.spec.ts
```

Product narrative and example lists: [docs/product/bakery-order-reconciliation.md](../../../docs/product/bakery-order-reconciliation.md).
