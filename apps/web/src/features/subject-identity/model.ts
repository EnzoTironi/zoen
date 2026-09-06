import type {
  IdentityFrame,
  IdentityRecoveryFrame,
} from "@zoen/contracts/subject-identity/frame";
import type { SubjectIdentitySuccess } from "@zoen/contracts/subject-identity/operations";
import type { IdentityQuestion } from "@zoen/contracts/subject-identity/question";

export type IdentityInspectedFrame = IdentityFrame | IdentityRecoveryFrame;
export type IdentityAnswerValue =
  | "same-as"
  | "different-from"
  | "confirm"
  | "unknown";

export interface SubjectIdentityState {
  readonly frame: IdentityInspectedFrame | null;
  readonly question: IdentityQuestion | null;
  readonly pendingAnswer: IdentityAnswerValue | null;
  readonly receipt: Extract<
    SubjectIdentitySuccess,
    { readonly receiptRef: string }
  > | null;
  readonly resolved: Extract<
    SubjectIdentitySuccess,
    { readonly _tag: "IdentityResolved" }
  > | null;
  readonly stale: boolean;
}

export const emptySubjectIdentity: SubjectIdentityState = {
  frame: null,
  pendingAnswer: null,
  question: null,
  receipt: null,
  resolved: null,
  stale: false,
};

export const recoveryNotice =
  "Esta leitura estrutural declara comparison: not-requested. Não calcula comparação de valores; confirmar aplica a transformação completa do grafo.";

export const privateAudience =
  "Identidade é privada do autor. Leitores compartilhados não recebem Frames, Questions nem controles de merge/split/undo.";

export const identityPatch = (
  result: SubjectIdentitySuccess
): Partial<SubjectIdentityState> => {
  switch (result._tag) {
    case "SubjectIdentityInspected":
    case "IdentityRecoveryInspected": {
      return {
        frame: result.frame,
        pendingAnswer: null,
        question: null,
        receipt: null,
        resolved: null,
        stale: false,
      };
    }
    case "IdentityProposed": {
      return {
        pendingAnswer: null,
        question: result.question,
        receipt: result,
        resolved: null,
        stale: false,
      };
    }
    case "IdentityResolved": {
      return {
        pendingAnswer: null,
        question: null,
        receipt: result,
        resolved: result,
        stale: false,
      };
    }
    default: {
      return {};
    }
  }
};
