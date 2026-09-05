import type { VisibleFrame } from "@zoen/contracts/d01/evidence";
import type {
  CorrectionProposed,
  CorrectionSuccess,
} from "@zoen/contracts/d01/operations";
import type { WorldRef } from "@zoen/contracts/d01/values";

export interface CorrectionContext {
  readonly frame: VisibleFrame | null;
  readonly proposal: typeof CorrectionProposed.Type | null;
  readonly world: WorldRef | null;
}

export const correctionPatch = (result: CorrectionSuccess) => {
  if (result._tag === "CorrectionProposed") {
    return {
      busy: false,
      feedback: "Confira a proposta antes de responder.",
      proposal: result,
    };
  }
  return {
    busy: false,
    feedback: `${result._tag === "CorrectionApplied" ? "Decisão registrada" : "Decisão desfeita"}. Recibo ${result.receiptRef}. Consulte as fontes para abrir uma nova leitura.`,
    frame: null,
    proposal: null,
    view: { kind: "empty" as const },
  };
};
