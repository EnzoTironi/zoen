import { randomUUID } from "node:crypto";

import { NotFoundOrDenied, Unavailable } from "@zoen/contracts/d01/errors";
import { VisibleFrame } from "@zoen/contracts/d01/evidence";
import { EvidenceOpened } from "@zoen/contracts/d01/operations";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  errorView,
  inspectionView,
} from "../../../src/features/d01/presentation.ts";

const frame = Schema.decodeUnknownSync(VisibleFrame)({
  claims: [
    { amount: "0.00", label: "Fonte A" },
    { amount: null, label: "Fonte B" },
  ].map((item, index) => ({
    claimRef: randomUUID(),
    evidenceRef: randomUUID(),
    predicate: "obligation.amount",
    recordId: `record-${index}`,
    recordIndex: index,
    source: {
      externalId: `source-${index}`,
      label: item.label,
      namespace: "manual",
      revision: "1",
    },
    sourceRef: randomUUID(),
    subjectKey: "invoice-1",
    validTime: { _tag: "Unknown" },
    value:
      item.amount === null
        ? { _tag: "Unknown" }
        : { _tag: "Known", amount: item.amount, currency: "BRL" },
    verification: "unverified",
  })),
  contested: false,
  coverage: { _tag: "Partial" },
  frameRef: randomUUID(),
  scopedCorrections: [],
  selection: { _tag: "unresolved" },
  subjectKey: "invoice-1",
  verification: "unverified",
  worldRef: { realm: "live", worldId: randomUUID() },
});

describe("EX12 presentation", () => {
  it("EX12 presentation preserves server selection, zero, unknown and incomplete coverage independently", () => {
    const view = inspectionView(frame, "verified-session-context");
    expect(view.sources.map((source) => source.value)).toStrictEqual([
      "0.00 BRL",
      "Valor desconhecido",
    ]);
    expect(view.statusLabel).toBe("Ainda sem conclusão");
    expect(view.verificationLabel).toBe(
      "Não verificado — não comprova pagamento"
    );
    expect(view.coverageLabel).toContain("Parcial");
    expect(view.sources[0]?.description).toBe("Período desconhecido");
  });

  it("EX12 interaction identity changes with authorized context, World and retained frame", () => {
    const original = inspectionView(frame, "session-a").interactionKey;
    const differentSession = inspectionView(frame, "session-b").interactionKey;
    const differentFrame = inspectionView(
      Schema.decodeSync(VisibleFrame)({
        ...frame,
        frameRef: randomUUID(),
      }),
      "session-a"
    ).interactionKey;
    const differentWorld = inspectionView(
      Schema.decodeSync(VisibleFrame)({
        ...frame,
        worldRef: { ...frame.worldRef, worldId: randomUUID() },
      }),
      "session-a"
    ).interactionKey;
    expect(
      new Set([original, differentSession, differentFrame, differentWorld]).size
    ).toBe(4);
  });

  it("EX12 only attaches opened evidence when its reference belongs to the visible frame", () => {
    const [first] = frame.claims;
    if (first === undefined) {
      throw new Error("Fixture requires one visible claim");
    }
    const opened = Schema.decodeSync(EvidenceOpened)({
      _tag: "EvidenceOpened",
      document: '{"private":"retained bytes"}',
      evidenceRef: first.evidenceRef,
      mediaType: "application/json",
    });
    const current = inspectionView(frame, "session-a", opened);
    const other = inspectionView(
      frame,
      "session-a",
      Schema.decodeSync(EvidenceOpened)({
        ...opened,
        evidenceRef: randomUUID(),
      })
    );
    expect(current.evidence?.excerpt).toBe(opened.document);
    expect(current.evidence?.sourceName).toBe("Fonte A");
    expect(other.evidence).toBeUndefined();
  });

  it("EX12 public denied and unavailable states retain no inspection payload", () => {
    expect(
      errorView(new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" }))
    ).toStrictEqual({ kind: "denied" });
    expect(errorView(new Unavailable({ code: "UNAVAILABLE" }))).toStrictEqual({
      kind: "unavailable",
    });
  });
});
