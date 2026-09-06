import {
  InvalidInput,
  NotFoundOrDenied,
  Stale,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import { PrincipalRef } from "@zoen/contracts/sharing/operations";
import {
  IdentityFrame,
  IdentityRecoveryFrame,
} from "@zoen/contracts/subject-identity/frame";
import {
  InspectIdentityRecovery,
  InspectSubjectIdentity,
  IdentityRecoveryInspected,
  SubjectIdentityInspected,
} from "@zoen/contracts/subject-identity/operations";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  validateContext,
  withinRequestDeadline,
} from "../../../access/context.js";
import { authorizeWorld } from "../../../access/world.js";
import { AuthorityInstallation } from "../../../commit/configuration.js";
import { readCut } from "../../../commit/guards.js";
import {
  restoreSqlDefect,
  sanitizeSqlFailure,
} from "../../../commit/transaction.js";
import type { VerifiedRequestContext } from "../../../ports/d01/context.js";
import { readClosureClaims } from "../persistence/claims.js";
import {
  identityScopeFrom,
  loadIdentityProjection,
} from "../persistence/decisions.js";
import { closeIdentity } from "../pure/graph.js";
import {
  buildComparisonFrame,
  buildRecoveryFrame,
  persistIdentityFrame,
  primarySubjectKey,
} from "./build.js";

export const inspectSubjectIdentity = Effect.fn(
  "subjectIdentity.inspectSubjectIdentity"
)(
  function* inspectSubjectIdentity(
    context: VerifiedRequestContext,
    input: typeof InspectSubjectIdentity.Type
  ) {
    const request = yield* Schema.decodeEffect(InspectSubjectIdentity)(
      input
    ).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
    const sql = yield* SqlClient.SqlClient;
    const installation = yield* AuthorityInstallation;
    const principalRef = yield* Schema.decodeEffect(PrincipalRef)(
      context.presence.principalId
    ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const frame = yield* sql
      .withTransaction(
        Effect.gen(function* snapshot() {
          yield* sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`;
          const access = yield* authorizeWorld(
            context,
            request.worldRef,
            "read"
          );
          if (access.role !== "owner") {
            return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
          }
          if (
            access.cell_id !== installation.cellId ||
            access.cell_epoch !== installation.cellEpoch ||
            access.release_digest !== installation.releaseDigest ||
            access.generation_id !== installation.generationId
          ) {
            return yield* new Stale({ code: "STALE" });
          }
          if (request.input.atFrame !== null) {
            const [row] = yield* sql`SELECT visible_frame FROM authority.frames
            WHERE world_id = ${request.worldRef.worldId} AND realm = ${request.worldRef.realm}
              AND frame_id = ${request.input.atFrame}
              AND principal_id = ${context.presence.principalId}
              AND purpose = ${context.purpose}`;
            if (row === undefined) {
              return yield* new NotFoundOrDenied({
                code: "NOT_FOUND_OR_DENIED",
              });
            }
            const saved = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ visible_frame: IdentityFrame })
            )(row);
            if (
              saved.visible_frame.frameRef !== request.input.atFrame ||
              saved.visible_frame.kind !== "subject-identity"
            ) {
              return yield* new Unavailable({ code: "UNAVAILABLE" });
            }
            return saved.visible_frame;
          }
          const cut = yield* readCut(request.worldRef);
          const scope = identityScopeFrom(
            request.worldRef,
            principalRef,
            context.purpose
          );
          const projection = yield* loadIdentityProjection(scope);
          const closureSeed = yield* Effect.succeed(request.input.anchors);
          const closure = yield* closeIdentity(
            projection,
            closureSeed,
            request.input.interval
          );
          const entries = yield* readClosureClaims(
            request.worldRef,
            closure.anchors
          );
          const sources = [
            ...new Map(
              entries.map((entry) => [
                entry.dependency.evidenceRef,
                entry.dependency,
              ])
            ).values(),
          ];
          const built = yield* buildComparisonFrame({
            claims: entries.map((entry) => entry.claim),
            cut,
            head: {
              cellEpoch: access.cell_epoch,
              generationId: access.generation_id,
              releaseDigest: access.release_digest,
              securityRevision: access.security_revision,
            },
            interval: request.input.interval,
            membershipRevision: access.membership_revision,
            principalRef,
            projection,
            purpose: context.purpose,
            seeds: request.input.anchors,
            sources,
            worldRef: request.worldRef,
          });
          yield* persistIdentityFrame({
            basis: built.basis,
            frame: built.frame,
            principalId: context.presence.principalId,
            purpose: context.purpose,
            subjectKey: primarySubjectKey(request.input.anchors),
            worldRef: request.worldRef,
          });
          return built.frame;
        }).pipe(
          Effect.tap(() => validateContext(context)),
          withinRequestDeadline(context)
        )
      )
      .pipe(restoreSqlDefect, sanitizeSqlFailure);
    yield* authorizeWorld(context, request.worldRef, "read");
    return yield* Schema.decodeEffect(SubjectIdentityInspected)({
      _tag: "SubjectIdentityInspected",
      frame,
    });
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);

export const inspectIdentityRecovery = Effect.fn(
  "subjectIdentity.inspectIdentityRecovery"
)(
  function* inspectIdentityRecovery(
    context: VerifiedRequestContext,
    input: typeof InspectIdentityRecovery.Type
  ) {
    const request = yield* Schema.decodeEffect(InspectIdentityRecovery)(
      input
    ).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
    const sql = yield* SqlClient.SqlClient;
    const installation = yield* AuthorityInstallation;
    const principalRef = yield* Schema.decodeEffect(PrincipalRef)(
      context.presence.principalId
    ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const frame = yield* sql
      .withTransaction(
        Effect.gen(function* snapshot() {
          yield* sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`;
          const access = yield* authorizeWorld(
            context,
            request.worldRef,
            "read"
          );
          if (access.role !== "owner") {
            return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
          }
          if (
            access.cell_id !== installation.cellId ||
            access.cell_epoch !== installation.cellEpoch ||
            access.release_digest !== installation.releaseDigest ||
            access.generation_id !== installation.generationId
          ) {
            return yield* new Stale({ code: "STALE" });
          }
          if (request.input.atFrame !== null) {
            const [row] = yield* sql`SELECT visible_frame FROM authority.frames
            WHERE world_id = ${request.worldRef.worldId} AND realm = ${request.worldRef.realm}
              AND frame_id = ${request.input.atFrame}
              AND principal_id = ${context.presence.principalId}
              AND purpose = ${context.purpose}`;
            if (row === undefined) {
              return yield* new NotFoundOrDenied({
                code: "NOT_FOUND_OR_DENIED",
              });
            }
            const saved = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ visible_frame: IdentityRecoveryFrame })
            )(row);
            if (
              saved.visible_frame.frameRef !== request.input.atFrame ||
              saved.visible_frame.kind !== "subject-identity-recovery"
            ) {
              return yield* new Unavailable({ code: "UNAVAILABLE" });
            }
            return saved.visible_frame;
          }
          const cut = yield* readCut(request.worldRef);
          const scope = identityScopeFrom(
            request.worldRef,
            principalRef,
            context.purpose
          );
          const projection = yield* loadIdentityProjection(scope);
          const closure = yield* closeIdentity(
            projection,
            [request.input.anchor],
            request.input.interval
          );
          const entries = yield* readClosureClaims(
            request.worldRef,
            closure.anchors
          );
          const sources = [
            ...new Map(
              entries.map((entry) => [
                entry.dependency.evidenceRef,
                entry.dependency,
              ])
            ).values(),
          ];
          const built = yield* buildRecoveryFrame({
            anchor: request.input.anchor,
            cut,
            head: {
              cellEpoch: access.cell_epoch,
              generationId: access.generation_id,
              releaseDigest: access.release_digest,
              securityRevision: access.security_revision,
            },
            interval: request.input.interval,
            membershipRevision: access.membership_revision,
            principalRef,
            projection,
            purpose: context.purpose,
            sources,
            targetDecisionRef: request.input.targetDecisionRef,
            worldRef: request.worldRef,
          });
          yield* persistIdentityFrame({
            basis: built.basis,
            frame: built.frame,
            principalId: context.presence.principalId,
            purpose: context.purpose,
            subjectKey: request.input.anchor,
            worldRef: request.worldRef,
          });
          return built.frame;
        }).pipe(
          Effect.tap(() => validateContext(context)),
          withinRequestDeadline(context)
        )
      )
      .pipe(restoreSqlDefect, sanitizeSqlFailure);
    yield* authorizeWorld(context, request.worldRef, "read");
    return yield* Schema.decodeEffect(IdentityRecoveryInspected)({
      _tag: "IdentityRecoveryInspected",
      frame,
    });
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
