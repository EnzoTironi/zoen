import { randomUUID } from "node:crypto";

import { VisibleFrame } from "@zoen/contracts/worlds/evidence";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { inspectionView } from "../../../src/features/worlds/presentation.ts";

const contestedBakeryFrame = Schema.decodeUnknownSync(VisibleFrame)({
  claims: [
    {
      amount: "450.00",
      label: "Lista de pedidos dos clientes — 20/09",
      namespace: "bakery.orders",
    },
    {
      amount: "520.00",
      label: "Lista de produção da loja — 20/09",
      namespace: "bakery.shop",
    },
  ].map((item, index) => ({
    claimRef: randomUUID(),
    evidenceRef: randomUUID(),
    predicate: "obligation.amount",
    recordId: `bolo-${index}`,
    recordIndex: index,
    source: {
      externalId: `list-${index}`,
      label: item.label,
      namespace: item.namespace,
      revision: "1",
    },
    sourceRef: randomUUID(),
    subjectKey: "pedido-bolo-casamento-2026-09-20",
    validTime: {
      _tag: "DateInterval",
      from: "2026-09-20",
      to: "2026-09-21",
    },
    value: { _tag: "Known", amount: item.amount, currency: "BRL" },
    verification: "unverified",
  })),
  contested: true,
  coverage: { _tag: "Partial" },
  frameRef: randomUUID(),
  scopedCorrections: [],
  selection: { _tag: "unresolved" },
  subjectKey: "pedido-bolo-casamento-2026-09-20",
  verification: "unverified",
  worldRef: { realm: "live", worldId: randomUUID() },
});

describe("ZA-23 bakery presentation", () => {
  it("ZA-23-01 contested order lists show scoped competing claims", () => {
    const view = inspectionView(contestedBakeryFrame, "bakery-session");
    expect(view.title).toBe("pedido-bolo-casamento-2026-09-20");
    expect(view.explanation).toMatch(/fontes divergem/u);
    expect(view.statusLabel).toContain("fontes divergentes");
    expect(view.sources.map((source) => source.name)).toStrictEqual([
      "Lista de pedidos dos clientes — 20/09",
      "Lista de produção da loja — 20/09",
    ]);
    expect(view.verificationLabel).toBe(
      "Não verificado — não comprova pagamento"
    );
  });
});
