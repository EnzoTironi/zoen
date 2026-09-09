import { randomUUID } from "node:crypto";

import { VisibleFrame } from "@zoen/contracts/worlds/evidence";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { inspectionView } from "../../../src/features/worlds/presentation.ts";

const contestedFinanceFrame = Schema.decodeUnknownSync(VisibleFrame)({
  claims: [
    {
      amount: "3500.00",
      label: "Livro-razão / faturas — setembro (reconhecimento)",
      namespace: "finance.ledger",
    },
    {
      amount: "3200.00",
      label: "Extrato autorizado — setembro (liquidação reportada)",
      namespace: "finance.statement",
    },
  ].map((item, index) => ({
    claimRef: randomUUID(),
    evidenceRef: randomUUID(),
    predicate: "obligation.amount",
    recordId: `fatura-${index}`,
    recordIndex: index,
    source: {
      externalId: `list-${index}`,
      label: item.label,
      namespace: item.namespace,
      revision: "1",
    },
    sourceRef: randomUUID(),
    subjectKey: "fatura-consultoria-2026-09",
    validTime: {
      _tag: "DateInterval",
      from: "2026-09-01",
      to: "2026-10-01",
    },
    value: { _tag: "Known", amount: item.amount, currency: "BRL" },
    verification: "unverified",
  })),
  contested: true,
  coverage: { _tag: "Partial" },
  frameRef: randomUUID(),
  scopedCorrections: [],
  selection: { _tag: "unresolved" },
  subjectKey: "fatura-consultoria-2026-09",
  verification: "unverified",
  worldRef: { realm: "live", worldId: randomUUID() },
});

describe("ZA-25 finance presentation", () => {
  it("ZA-25-01 contested ledger vs statement retain sources with exact amounts and no payment proof", () => {
    const view = inspectionView(contestedFinanceFrame, "finance-session");
    expect(view.title).toBe("fatura-consultoria-2026-09");
    expect(`${view.explanation} · ${view.statusLabel}`).toMatch(
      /fontes divergem.*fontes divergentes/su
    );
    expect(
      view.sources.map((source) => ({ name: source.name, value: source.value }))
    ).toStrictEqual([
      {
        name: "Livro-razão / faturas — setembro (reconhecimento)",
        value: "3500.00 BRL",
      },
      {
        name: "Extrato autorizado — setembro (liquidação reportada)",
        value: "3200.00 BRL",
      },
    ]);
    expect(view.verificationLabel).toBe(
      "Não verificado — não comprova pagamento"
    );
  });
});
