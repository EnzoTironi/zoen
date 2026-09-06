import { InvalidInput, Unavailable } from "@zoen/contracts/d01/errors";
import type { D01Error } from "@zoen/contracts/d01/errors";
import { Inspect, OpenEvidence } from "@zoen/contracts/d01/operations";
import type {
  CorrectionRequest,
  SemanticSuccess,
  SemanticRequest,
} from "@zoen/contracts/d01/operations";
import { WorldRef } from "@zoen/contracts/d01/values";
import { Effect, Exit, ManagedRuntime, Result, Schema } from "effect";

import {
  answerRequest,
  proposeRequest,
  undoRequest,
} from "../../integration/d02/requests.ts";
import { emptySharing } from "../sharing/model.ts";
import {
  confirmAccessRequest,
  inspectAccessRequest,
} from "../sharing/requests.ts";
import {
  emptySubjectIdentity,
  identityPatch,
} from "../subject-identity/model.ts";
import type { IdentityAnswerValue } from "../subject-identity/model.ts";
import {
  inspectIdentityRecoveryRequest,
  inspectIdentityRequest,
  partitionAnchorAway,
  proposeSameAsRequest,
  proposeSplitRequest,
  proposeUndoRequest,
  resolveIdentityRequest,
} from "../subject-identity/requests.ts";
import { BrowserApi, browserApiLayer } from "./client.ts";
import { initialState, successPatch } from "./model.ts";
import type { WorkspaceState } from "./model.ts";
import { errorMessage, errorView } from "./presentation.ts";
import type { ImportFileFormat } from "./requests.ts";
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
      identity: emptySubjectIdentity,
      membership: null,
      proposal: null,
      sharing: emptySharing,
      view: { kind: "empty" },
      ...patch,
    });
  };
  const failed = (error: D01Error) => {
    const failedRequest = retry;
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
    } else if (error._tag === "NotFoundOrDenied") {
      invalidate({
        actionError: errorMessage(error),
        feedback: errorMessage(error),
        view: errorView(error),
        world: null,
      });
    } else {
      const operation = failedRequest?.operation;
      const identityStale =
        error._tag === "Stale" &&
        (operation === "InspectSubjectIdentity" ||
          operation === "InspectIdentityRecovery" ||
          operation === "ProposeIdentityResolution" ||
          operation === "ProposeIdentitySplit" ||
          operation === "ProposeIdentityUndo" ||
          operation === "ResolveIdentity");
      const sharingStale =
        error._tag === "Stale" &&
        (operation === "InspectWorldAccess" ||
          operation === "GrantWorldReadAccess" ||
          operation === "RevokeWorldReadAccess");
      publish({
        ...(error._tag === "Stale"
          ? {
              identity: identityStale
                ? { ...emptySubjectIdentity, stale: true }
                : emptySubjectIdentity,
              sharing: sharingStale
                ? { ...emptySharing, stale: true }
                : emptySharing,
            }
          : {
              identity: {
                ...state.identity,
                pendingAnswer: null,
                question: null,
              },
              sharing: { ...state.sharing, confirmation: null, target: null },
            }),
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
  const consume = (result: SemanticSuccess, request: SemanticRequest) => {
    if (result._tag === "WorldAccessInspected") {
      if (request.operation !== "InspectWorldAccess") {
        return;
      }
      publish({
        actionError: null,
        busy: false,
        canRetry: false,
        feedback: "",
        view:
          state.view.kind === "unavailable" ? { kind: "empty" } : state.view,
        ...(request.input.principalRef === null
          ? { membership: result.membership }
          : {
              sharing: {
                ...state.sharing,
                confirmation: null,
                stale: false,
                target: {
                  membership: result.membership,
                  principalRef: request.input.principalRef,
                },
              },
            }),
      });
      return;
    }
    if (
      result._tag === "WorldReadAccessGranted" ||
      result._tag === "WorldReadAccessRevoked"
    ) {
      publish({ sharing: { ...emptySharing, receipt: result } });
      return;
    }
    if (
      result._tag === "SubjectIdentityInspected" ||
      result._tag === "IdentityRecoveryInspected" ||
      result._tag === "IdentityProposed" ||
      result._tag === "IdentityResolved"
    ) {
      publish({
        actionError: null,
        busy: false,
        canRetry: false,
        feedback: "",
        identity: { ...state.identity, ...identityPatch(result) },
      });
      return;
    }
    const patch = successPatch(state, result);
    if (result._tag === "WorldCreated") {
      invalidate(patch);
    } else {
      publish({ ...patch, actionError: null, canRetry: false });
    }
  };
  const execute = Effect.fn("web.execute")(function* executeRequest(
    request: SemanticRequest
  ): Effect.fn.Return<void, never, BrowserApi> {
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
        consume(recovered.success, request);
      }
      const own =
        result.success._tag === "WorldCreated"
          ? yield* inspectAccessRequest(result.success.worldRef, null).pipe(
              Effect.orDie
            )
          : null;
      retry = null;
      consume(result.success, request);
      if (own !== null) {
        launch(execute(own));
      }
      if (
        result.success._tag === "WorldReadAccessGranted" ||
        result.success._tag === "WorldReadAccessRevoked"
      ) {
        const current = yield* inspectAccessRequest(
          result.success.worldRef,
          result.success.membershipAtCommit.principalRef
        ).pipe(Effect.orDie);
        // The receipt is historical. Only this new inspection supplies displayed current access.
        publish({ busy: false });
        yield* execute(current);
      }
    }
  });
  const revalidateContent = Effect.fn("web.revalidateContent")(
    function* revalidateContent(started: number) {
      const { world } = state;
      if (state.session !== null && world !== null && !state.busy) {
        const own = yield* inspectAccessRequest(world, null);
        const access = yield* BrowserApi.pipe(
          Effect.flatMap((api) => api.execute(own)),
          Effect.result
        );
        if (started !== epoch || disposed) {
          return;
        }
        if (Result.isFailure(access)) {
          failed(access.failure);
          return;
        }
        if (state.busy) {
          return;
        }
        if (access.success._tag === "WorldAccessInspected") {
          publish({ membership: access.success.membership });
        }
      }
      const { frame } = state;
      if (state.session === null || frame === null || state.busy) {
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
      if (started !== epoch || disposed) {
        return;
      }
      if (Result.isFailure(revalidated)) {
        failed(revalidated.failure);
      }
    }
  );
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
    yield* revalidateContent(started);
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
    cancelAccess: () => {
      if (!state.busy) {
        publish({ sharing: { ...state.sharing, confirmation: null } });
      }
    },
    confirmAccess: () => {
      const { world, sharing } = state;
      if (
        state.busy ||
        world === null ||
        sharing.target === null ||
        sharing.confirmation === null
      ) {
        return;
      }
      launch(
        confirmAccessRequest(world, sharing.target, sharing.confirmation).pipe(
          Effect.flatMap(execute),
          Effect.catchTag("InvalidInput", (failure) =>
            Effect.sync(() => {
              failed(failure);
            })
          )
        )
      );
    },
    confirmIdentityAnswer: () => {
      const { world, identity } = state;
      if (
        state.busy ||
        world === null ||
        identity.question === null ||
        identity.pendingAnswer === null
      ) {
        return;
      }
      launch(
        resolveIdentityRequest(
          world,
          identity.question.questionRef,
          identity.question.consequenceDigest,
          identity.pendingAnswer
        ).pipe(
          Effect.flatMap(execute),
          Effect.catchTag("InvalidInput", (failure) =>
            Effect.sync(() => {
              failed(failure);
            })
          )
        )
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
    importFiles: (
      files: readonly File[],
      format: ImportFileFormat = "json"
    ) => {
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
            const parsed = yield* importRequest(file, world, format).pipe(
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
    inspectIdentity: (anchors: readonly string[], from: string, to: string) => {
      if (state.world === null || state.busy) {
        return;
      }
      publish({ identity: emptySubjectIdentity });
      launch(
        inspectIdentityRequest(state.world, anchors, from, to, null).pipe(
          Effect.flatMap(execute),
          Effect.catchTag("InvalidInput", (failure) =>
            Effect.sync(() => {
              failed(failure);
            })
          )
        )
      );
    },
    inspectIdentityRecovery: (
      anchor: string,
      from: string,
      to: string,
      targetDecisionRef: string | null
    ) => {
      if (state.world === null || state.busy) {
        return;
      }
      publish({ identity: emptySubjectIdentity });
      launch(
        inspectIdentityRecoveryRequest(
          state.world,
          anchor,
          from,
          to,
          targetDecisionRef
        ).pipe(
          Effect.flatMap(execute),
          Effect.catchTag("InvalidInput", (failure) =>
            Effect.sync(() => {
              failed(failure);
            })
          )
        )
      );
    },
    inspectRecipient: (principalRef: string) => {
      if (state.world === null || state.busy) {
        return;
      }
      publish({ sharing: emptySharing });
      launch(
        inspectAccessRequest(state.world, principalRef).pipe(
          Effect.flatMap(execute),
          Effect.catchTag("InvalidInput", (failure) =>
            Effect.sync(() => {
              failed(failure);
            })
          )
        )
      );
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
    prepareAccess: (action: "grant" | "revoke") => {
      if (state.busy || state.sharing.target === null) {
        return;
      }
      publish({ sharing: { ...state.sharing, confirmation: action } });
    },
    prepareIdentityAnswer: (answer: IdentityAnswerValue | null) => {
      if (state.busy || state.identity.question === null) {
        return;
      }
      publish({
        identity: { ...state.identity, pendingAnswer: answer },
      });
    },
    proposeCorrection: (from: string, to: string, choice: string) => {
      correct(proposeRequest(state, from, to, choice));
    },
    proposeIdentitySplit: (anchor: string) => {
      const { world, identity } = state;
      if (state.busy || world === null || identity.frame === null) {
        return;
      }
      launch(
        proposeSplitRequest(
          world,
          identity.frame,
          anchor,
          partitionAnchorAway(identity.frame, anchor)
        ).pipe(
          Effect.flatMap(execute),
          Effect.catchTag("InvalidInput", (failure) =>
            Effect.sync(() => {
              failed(failure);
            })
          )
        )
      );
    },
    proposeIdentityUndo: (targetDecisionRef: string) => {
      const { world, identity } = state;
      if (state.busy || world === null || identity.frame === null) {
        return;
      }
      launch(
        proposeUndoRequest(world, identity.frame, targetDecisionRef).pipe(
          Effect.flatMap(execute),
          Effect.catchTag("InvalidInput", (failure) =>
            Effect.sync(() => {
              failed(failure);
            })
          )
        )
      );
    },
    proposeSameAs: (left: string, right: string) => {
      const { world, identity } = state;
      if (state.busy || world === null || identity.frame === null) {
        return;
      }
      launch(
        proposeSameAsRequest(world, identity.frame, left, right).pipe(
          Effect.flatMap(execute),
          Effect.catchTag("InvalidInput", (failure) =>
            Effect.sync(() => {
              failed(failure);
            })
          )
        )
      );
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
      launch(
        inspectAccessRequest(world.value, null).pipe(
          Effect.flatMap(execute),
          Effect.orDie
        )
      );
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
