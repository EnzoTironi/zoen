# ZA-24 acceptance — clinic administrative scope

**ICP:** clínica / clinic administration · **Ticket:** ZA-24

Automated proofs for this ticket:

| Seam | Path | Covers |
| --- | --- | --- |
| Unit (selection / clinical exclusion) | `packages/ontology/test/knowledge/selection.ZA24.test.ts` | ZA-24-01 contested fees; ZA-24-02 clinical predicates rejected before retrieval |
| Integration (PG + S3) | `tests/integration/clinic/administrative-scope.ZA24.integration.test.ts` | ZA-24-01, ZA-24-02, ZA-24-03 (mid-fetch revoke + admin work intact) |
| Browser + CLI | `apps/web/test/features/clinic/clinic.ZA24.browser.spec.ts` | ZA-24-01 contested inspection, CLI parity, correction |

Run against a real disposable compose (PostgreSQL + object storage) and a normal account. No test-defined interpretation or permission booleans. Clinical corpus is never admitted in this fixture.

```bash
pnpm test:unit -- packages/ontology/test/knowledge/selection.ZA24.test.ts
pnpm test:integration -- tests/integration/clinic/administrative-scope.ZA24.integration.test.ts
ZOEN_TEST_WEB_URL=http://127.0.0.1:4310 \
pnpm test:acceptance -- apps/web/test/features/clinic/clinic.ZA24.browser.spec.ts
```

Product narrative and example lists: [docs/product/clinic-administrative-scope.md](../../../docs/product/clinic-administrative-scope.md).
