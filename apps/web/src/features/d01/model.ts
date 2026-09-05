import type { VisibleFrame } from "@zoen/contracts/d01/evidence";
import type { D01Success } from "@zoen/contracts/d01/operations";
import type { WorldRef } from "@zoen/contracts/d01/values";

import type { WorkspaceView } from "../../components/d01/presentation.ts";
import type { BrowserSession } from "./client.ts";
import { inspectionView } from "./presentation.ts";

export interface WorkspaceState {
  readonly busy: boolean;
  readonly checking: boolean;
  readonly feedback: string;
  readonly frame: VisibleFrame | null;
  readonly session: BrowserSession | null;
  readonly view: WorkspaceView;
  readonly world: WorldRef | null;
}

export const initialState: WorkspaceState = {
  busy: false,
  checking: true,
  feedback: "",
  frame: null,
  session: null,
  view: { kind: "empty" },
  world: null,
};

export const successPatch = (
  state: WorkspaceState,
  result: D01Success
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
    default: {
      return {};
    }
  }
};
