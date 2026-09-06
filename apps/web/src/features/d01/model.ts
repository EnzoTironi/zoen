import type { VisibleFrame } from "@zoen/contracts/d01/evidence";
import type {
  CorrectionSuccess,
  D01Success,
} from "@zoen/contracts/d01/operations";
import type { WorldRef } from "@zoen/contracts/d01/values";
import type { Membership } from "@zoen/contracts/sharing/operations";

import type { WorkspaceView } from "../../components/d01/presentation.ts";
import { correctionPatch } from "../../integration/d02/model.ts";
import type { CorrectionContext } from "../../integration/d02/model.ts";
import { emptySharing } from "../sharing/model.ts";
import type { SharingState } from "../sharing/model.ts";
import { emptySubjectIdentity } from "../subject-identity/model.ts";
import type { SubjectIdentityState } from "../subject-identity/model.ts";
import type { BrowserSession } from "./client.ts";
import { inspectionView } from "./presentation.ts";

export interface WorkspaceState extends CorrectionContext {
  readonly membership: Membership | null;
  readonly sharing: SharingState;
  readonly identity: SubjectIdentityState;
  readonly actionError: string | null;
  readonly busy: boolean;
  readonly canRetry: boolean;
  readonly checking: boolean;
  readonly feedback: string;
  readonly frame: VisibleFrame | null;
  readonly session: BrowserSession | null;
  readonly view: WorkspaceView;
  readonly world: WorldRef | null;
}

export const initialState: WorkspaceState = {
  actionError: null,
  busy: false,
  canRetry: false,
  checking: true,
  feedback: "",
  frame: null,
  identity: emptySubjectIdentity,
  membership: null,
  proposal: null,
  session: null,
  sharing: emptySharing,
  view: { kind: "empty" },
  world: null,
};

export const successPatch = (
  state: WorkspaceState,
  result: D01Success | CorrectionSuccess
): Partial<WorkspaceState> => {
  switch (result._tag) {
    case "WorldCreated": {
      return {
        feedback: "Seu espaço privado está pronto.",
        world: result.worldRef,
      };
    }
    case "EvidenceImported": {
      return {
        busy: false,
        feedback:
          "Fonte admitida. Informe a obrigação para consultar os registros.",
        frame: null,
        view: { kind: "empty" },
      };
    }
    case "FrameInspected": {
      const { session } = state;
      if (session === null) {
        return {};
      }
      return {
        busy: false,
        feedback: "",
        frame: result.frame,
        proposal: null,
        view: {
          inspection: inspectionView(
            result.frame,
            `${session.user.id}:${session.session.id}`
          ),
          kind: "inspection",
        },
      };
    }
    case "EvidenceOpened": {
      const { session, frame } = state;
      if (session === null || frame === null) {
        return { busy: false };
      }
      return {
        busy: false,
        view: {
          inspection: inspectionView(
            frame,
            `${session.user.id}:${session.session.id}`,
            result
          ),
          kind: "inspection",
        },
      };
    }
    case "CorrectionProposed":
    case "CorrectionApplied":
    case "CorrectionUndone": {
      return correctionPatch(result);
    }
    default: {
      return {};
    }
  }
};
