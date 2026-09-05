import { InvalidInput, Unavailable } from "@zoen/contracts/d01/errors";
import type { D01Error } from "@zoen/contracts/d01/errors";
import { Inspect, OpenEvidence } from "@zoen/contracts/d01/operations";
import type {
  CorrectionRequest,
  SemanticRequest,
  SemanticSuccess,
} from "@zoen/contracts/d01/operations";
import { WorldRef } from "@zoen/contracts/d01/values";
import { Effect, Exit, ManagedRuntime, Result, Schema } from "effect";

import {
  answerRequest,
  proposeRequest,
  undoRequest,
} from "../../integration/d02/requests.ts";
import { BrowserApi, browserApiLayer } from "./client.ts";
import { initialState, successPatch } from "./model.ts";
import type { WorkspaceState } from "./model.ts";
import { errorMessage, errorView } from "./presentation.ts";
import { createWorldRequest, envelope, importRequest } from "./requests.ts";
import { announceSessionChange } from "./session-events.ts";

/** Ephemeral presentation state, discarded on every session or World boundary. */
export const createWorkspaceController = (origin: string) => {
  let runtime: ReturnType<
    typeof ManagedRuntime.make<BrowserApi, never>
  > | null = null;
  let state = initialState;
  let epoch = 0;
  let active = new AbortController();
  let retry: SemanticRequest | null = null;
  let disposed = false;
  let refreshPaused = false;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<WorkspaceState>) => {
    if (disposed) {
      return;
    }
    state = { ...state, ...patch };
    for (const listener of listeners) {
      listener();
    }
  };
  const invalidate = (patch: Partial<WorkspaceState> = {}) => {
    epoch += 1;
    active.abort();
    active = new AbortController();
    retry = null;
    publish({
      actionError: null,
      busy: false,
      canRetry: false,
      feedback: "",
      frame: null,
      proposal: null,
      view: { kind: "empty" },
      ...patch,
    });
  };
  const failed = (error: D01Error) => {
    if (
      error._tag !== "Unavailable" &&
      error._tag !== "RetryableInfrastructureFailure"
    ) {
      retry = null;
    }
    if (error._tag === "Unauthenticated") {
      invalidate({
        checking: false,
        feedback: errorMessage(error),
        session: null,
        world: null,
      });
    } else {
      publish({
        actionError: errorMessage(error),
        busy: false,
        canRetry: retry !== null,
        feedback: errorMessage(error),
        frame: null,
        proposal: null,
        view: errorView(error),
      });
    }
  };
  const launch = <E>(effect: Effect.Effect<void, E, BrowserApi>) => {
    if (disposed) {
      return;
    }
    runtime ??= ManagedRuntime.make(browserApiLayer(origin));
    const started = epoch;
    runtime.runCallback(effect, {
      onExit: (exit) => {
        if (Exit.isFailure(exit) && started === epoch && !disposed) {
          failed(new Unavailable({ code: "UNAVAILABLE" }));
        }
      },
      signal: active.signal,
    });
  };
  const consume = (result: SemanticSuccess) => {
    const patch = successPatch(state, result);
    if (result._tag === "WorldCreated") {
      invalidate(patch);
    } else {
      publish({ ...patch, actionError: null, canRetry: false });
    }
  };
  const execute = Effect.fn("web.execute")(function* executeRequest(
    request: SemanticRequest
  ) {
    if (state.session === null || state.busy) {
      return;
    }
    const started = epoch;
    retry = request;
    publish({ actionError: null, busy: true, feedback: "" });
    const result = yield* BrowserApi.pipe(
      Effect.flatMap((api) => api.execute(request)),
      Effect.result
    );
    if (started !== epoch || disposed) {
      return;
    }
    if (Result.isFailure(result)) {
      failed(result.failure);
    } else {
      if (
        result.success._tag === "CorrectionProposed" &&
        state.frame === null
      ) {
        if (request.operation !== "ProposeCorrection") {
          failed(new Unavailable({ code: "UNAVAILABLE" }));
          return;
        }
        const { subjectKey } = result.success.consequence;
        const recovered = yield* BrowserApi.pipe(
          Effect.flatMap((api) =>
            api.execute(
              Schema.decodeSync(Inspect)({
                ...envelope,
                input: { atFrame: request.input.frameRef, subjectKey },
                operation: "Inspect",
                worldRef: request.worldRef,
              })
            )
          ),
          Effect.result
        );
        if (started !== epoch || disposed) {
          return;
        }
        if (Result.isFailure(recovered)) {
          failed(recovered.failure);
          return;
        }
        if (recovered.success._tag !== "FrameInspected") {
          failed(new Unavailable({ code: "UNAVAILABLE" }));
          return;
        }
        consume(recovered.success);
      }
      retry = null;
      consume(result.success);
    }
  });
  const refresh = Effect.fn("web.refresh")(function* refreshSession() {
    if (refreshPaused || disposed) {
      return;
    }
    const started = epoch;
    const result = yield* BrowserApi.pipe(
      Effect.flatMap((api) => api.session),
      Effect.result
    );
    if (started !== epoch || disposed) {
      return;
    }
    if (Result.isFailure(result)) {
      invalidate({
        checking: false,
        feedback: "Não foi possível verificar a sessão.",
        session: null,
        world: null,
      });
      return;
    }
    const session = result.success;
    if (
      session?.session.id !== state.session?.session.id ||
      session?.user.id !== state.session?.user.id
    ) {
      invalidate({ checking: false, session, world: null });
    } else {
      publish({ checking: false });
    }
    const { frame } = state;
    if (session === null || frame === null || state.busy) {
      return;
    }
    const request = yield* Schema.decodeEffect(Inspect)({
      ...envelope,
      input: { atFrame: frame.frameRef, subjectKey: frame.subjectKey },
      operation: "Inspect",
      worldRef: frame.worldRef,
    });
    const revalidated = yield* BrowserApi.pipe(
      Effect.flatMap((api) => api.execute(request)),
      Effect.result
    );
    if (
      started !== epoch ||
      disposed ||
      state.frame?.frameRef !== frame.frameRef
    ) {
      return;
    }
    if (Result.isFailure(revalidated)) {
      failed(revalidated.failure);
    }
  });
  const correct = (request: Effect.Effect<CorrectionRequest, InvalidInput>) => {
    if (state.busy || state.session === null) {
      return;
    }
    launch(
      request.pipe(
        Effect.flatMap(execute),
        Effect.catchTag("InvalidInput", (failure) =>
          Effect.sync(() => {
            failed(failure);
          })
        )
      )
    );
  };
  return {
    answerQuestion: (answer: "confirm" | "unknown") => {
      correct(answerRequest(state, answer));
    },
    authenticate: (
      mode: "sign-in" | "sign-up",
      email: string,
      password: string,
      name: string
    ) => {
      refreshPaused = false;
      announceSessionChange();
      invalidate({ busy: true, checking: false, session: null, world: null });
      const started = epoch;
      launch(
        Effect.gen(function* authenticate() {
          const result = yield* BrowserApi.pipe(
            Effect.flatMap((api) =>
              api.authenticate(mode, email, password, name)
            ),
            Effect.result
          );
          if (started !== epoch || disposed) {
            return;
          }
          if (Result.isFailure(result) || result.success === null) {
            publish({
              busy: false,
              feedback:
                "Não foi possível entrar. Confira suas credenciais ou tente novamente mais tarde.",
            });
          } else {
            publish({ busy: false, session: result.success });
            announceSessionChange();
          }
        })
      );
    },
    createWorld: () => {
      invalidate({ world: null });
      launch(
        Effect.gen(function* createWorld() {
          const request = yield* createWorldRequest;
          yield* execute(request);
        })
      );
    },
    dispose: () => {
      disposed = true;
      epoch += 1;
      active.abort();
      if (runtime !== null) {
        void runtime.dispose();
        runtime = null;
      }
    },
    getSnapshot: () => state,
    hide: () => {
      invalidate({ checking: !refreshPaused, session: null, world: null });
    },
    importFiles: (files: readonly File[]) => {
      const { world } = state;
      if (world === null || state.session === null || state.busy) {
        return;
      }
      const started = epoch;
      publish({
        actionError: null,
        busy: true,
        feedback: "",
        frame: null,
        proposal: null,
        view: { kind: "uploading", message: "Lendo e enviando as fontes…" },
      });
      launch(
        Effect.gen(function* importFiles() {
          for (const file of files) {
            const parsed = yield* importRequest(file, world).pipe(
              Effect.result
            );
            if (started !== epoch || disposed) {
              return;
            }
            if (Result.isFailure(parsed)) {
              failed(parsed.failure);
              return;
            }
            retry = parsed.success;
            const result = yield* BrowserApi.pipe(
              Effect.flatMap((api) => api.execute(parsed.success)),
              Effect.result
            );
            if (started !== epoch || disposed) {
              return;
            }
            if (Result.isFailure(result)) {
              failed(result.failure);
              return;
            }
            retry = null;
          }
          publish({
            busy: false,
            feedback:
              "Fontes admitidas. Informe a obrigação para consultar os registros.",
            view: { kind: "empty" },
          });
        })
      );
    },
    inspect: (subjectKey: string, atFrame: string | null = null) => {
      if (state.world === null) {
        return;
      }
      const request = Schema.decodeOption(Inspect)({
        ...envelope,
        input: { atFrame, subjectKey },
        operation: "Inspect",
        worldRef: state.world,
      });
      if (request._tag === "None") {
        failed(new InvalidInput({ code: "INVALID_INPUT" }));
        return;
      }
      launch(execute(request.value));
    },
    logout: () => {
      refreshPaused = true;
      announceSessionChange();
      invalidate({ checking: false, session: null, world: null });
      const started = epoch;
      launch(
        Effect.gen(function* logout() {
          const result = yield* BrowserApi.pipe(
            Effect.flatMap((api) => api.logout),
            Effect.result
          );
          if (started !== epoch || disposed) {
            return;
          }
          announceSessionChange();
          if (Result.isFailure(result)) {
            publish({
              feedback:
                "Os dados da tela foram removidos. Não foi possível confirmar a saída.",
            });
          }
        })
      );
    },
    openEvidence: (claimRef: string) => {
      const claim = state.frame?.claims.find(
        (candidate) => candidate.claimRef === claimRef
      );
      if (claim === undefined || state.world === null) {
        return;
      }
      launch(
        execute(
          Schema.decodeSync(OpenEvidence)({
            ...envelope,
            input: { evidenceRef: claim.evidenceRef },
            operation: "OpenEvidence",
            worldRef: state.world,
          })
        )
      );
    },
    proposeCorrection: (from: string, to: string, choice: string) => {
      correct(proposeRequest(state, from, to, choice));
    },
    refresh: () => {
      launch(refresh());
    },
    retry: () => {
      if (retry !== null) {
        launch(execute(retry));
      }
    },
    selectWorld: (worldId: string) => {
      invalidate({ world: null });
      const world = Schema.decodeOption(WorldRef)({ realm: "live", worldId });
      if (world._tag === "None") {
        failed(new InvalidInput({ code: "INVALID_INPUT" }));
        return;
      }
      publish({ world: world.value });
    },
    start: () => {
      disposed = false;
      invalidate({ checking: true, session: null, world: null });
      launch(refresh());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    undoCorrection: (correctionRef: string) => {
      correct(undoRequest(state, correctionRef));
    },
  };
};
export type WorkspaceController = ReturnType<typeof createWorkspaceController>;
