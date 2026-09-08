import { randomUUID } from "node:crypto";

import { VisibleFrame } from "@zoen/contracts/worlds/evidence";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import { inspectionView } from "../../../src/features/worlds/presentation.ts";

const contestedHouseholdFrame = Schema.decodeUnknownSync(VisibleFrame)({
  claims: [
    {
      amount: "189.90",
      label: "Extrato do banco — setembro",
      namespace: "household.bank",
    },
    {
      amount: "210.00",
      label: "Planilha de contas — setembro",
      namespace: "household.spreadsheet",
    },
  ].map((item, index) => ({
    claimRef: randomUUID(),
    evidenceRef: randomUUID(),
    predicate: "obligation.amount",
    recordId: `luz-${index}`,
    recordIndex: index,
    source: {
      externalId: `list-${index}`,
      label: item.label,
      namespace: item.namespace,
      revision: "1",
    },
    sourceRef: randomUUID(),
    subjectKey: "conta-luz-2026-09",
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
  subjectKey: "conta-luz-2026-09",
  verification: "unverified",
  worldRef: { realm: "live", worldId: randomUUID() },
});

describe("ZA-22 household presentation", () => {
  it("ZA-22-01 contested commitment lists explain both sources and current interpretation", () => {
    const view = inspectionView(contestedHouseholdFrame, "household-session");
    expect(view.title).toBe("conta-luz-2026-09");
    expect(view.explanation).toBe(
      "As fontes divergem em um período comparável. Confira ambas as fontes e a interpretação atual."
    );
    expect(view.statusLabel).toContain("fontes divergentes");
    expect(view.sources.map((source) => source.name)).toStrictEqual([
      "Extrato do banco — setembro",
      "Planilha de contas — setembro",
    ]);
    expect(view.verificationLabel).toBe(
      "Não verificado — não comprova pagamento"
    );
  });
});
