import type { WorldErasureSuccess } from "@zoen/contracts/erasure/operations";
import type {
  ErasureAttemptExternalState,
  WorldErasurePhase,
} from "@zoen/contracts/erasure/values";

export interface ErasureProgress {
  readonly attemptExternalState: ErasureAttemptExternalState;
  readonly phase: WorldErasurePhase;
  readonly restoreAfterErasure: false;
  readonly revision: Extract<
    WorldErasureSuccess,
    { readonly revision: unknown }
  >["revision"];
}

export interface ErasureState {
  readonly confirmation: boolean;
  readonly progress: ErasureProgress | null;
  readonly receipt: Extract<
    WorldErasureSuccess,
    { readonly _tag: "WorldErasureRequested" }
  > | null;
  readonly stale: boolean;
}

export const emptyErasure: ErasureState = {
  confirmation: false,
  progress: null,
  receipt: null,
  stale: false,
};

export const entireWorldScope =
  "A exclusão cobre este espaço inteiro: Frames, Questions, correções, grants de conteúdo, imports, objetos admitidos/staged e versões órfãs do namespace. Não apaga a conta, outros espaços, nem cópias já liberadas ao transporte.";

export const noRestoreNotice =
  "Restore após erasure permanece bloqueado. Esta superfície não oferece reabertura de conteúdo apagado e não promove o estado para Erased.";

export const erasurePatch = (
  result: WorldErasureSuccess
): Partial<ErasureState> => {
  switch (result._tag) {
    case "WorldErasureInspected": {
      return {
        confirmation: false,
        progress: {
          attemptExternalState: result.attemptExternalState,
          phase: result.phase,
          restoreAfterErasure: false,
          revision: result.revision,
        },
        stale: false,
      };
    }
    case "WorldErasureRequested": {
      return {
        confirmation: false,
        progress: {
          attemptExternalState: result.attemptExternalState,
          phase: result.phase,
          restoreAfterErasure: false,
          revision: result.revision,
        },
        receipt: result,
        stale: false,
      };
    }
    default: {
      return {};
    }
  }
};
