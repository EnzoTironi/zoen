import { randomUUID } from "node:crypto";

import {
  InvalidInput,
  NotFoundOrDenied,
  Stale,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import { VisibleFrame } from "@zoen/contracts/d01/evidence";
import { FrameInspected, Inspect } from "@zoen/contracts/d01/operations";
import { FrameRef, Instant } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  validateContext,
  withinRequestDeadline,
} from "../../access/context.js";
import { authorizeWorld } from "../../access/world.js";
import { AuthorityInstallation } from "../../commit/configuration.js";
import { readCut } from "../../commit/guards.js";
import {
  restoreSqlDefect,
  sanitizeSqlFailure,
} from "../../commit/transaction.js";
import { InternalBasis, ReadSet } from "../../ports/d01/basis.js";
import type { VerifiedRequestContext } from "../../ports/d01/context.js";
import { canonicalJson, structuredDigest } from "../../values/canonical.js";
import { readScopedCorrections } from "../corrections/projection.js";
import { readClaims } from "./claims.js";
import { classifyClaims } from "./selection.js";

export const inspect = Effect.fn("authority.knowledge.inspect")(
  function* inspect(
    context: VerifiedRequestContext,
    input: typeof Inspect.Type
  ) {
    const request = yield* Schema.decodeEffect(Inspect)(input).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    const sql = yield* SqlClient.SqlClient;
    const installation = yield* AuthorityInstallation;
    const frame = yield* sql
      .withTransaction(
        Effect.gen(function* frameSnapshot() {
          yield* sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`;
          const access = yield* authorizeWorld(context, request.worldRef);
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
            AND frame_id = ${request.input.atFrame} AND principal_id = ${context.presence.principalId}
            AND purpose = ${context.purpose} AND subject_key = ${request.input.subjectKey}`;
            if (row === undefined) {
              return yield* new NotFoundOrDenied({
                code: "NOT_FOUND_OR_DENIED",
              });
            }
            const saved = yield* Schema.decodeUnknownEffect(
              Schema.Struct({ visible_frame: VisibleFrame })
            )(row);
            if (
              saved.visible_frame.frameRef !== request.input.atFrame ||
              saved.visible_frame.worldRef.worldId !==
                request.worldRef.worldId ||
              saved.visible_frame.worldRef.realm !== request.worldRef.realm ||
              saved.visible_frame.subjectKey !== request.input.subjectKey
            ) {
              return yield* new Unavailable({ code: "UNAVAILABLE" });
            }
            return saved.visible_frame;
          }
          const cut = yield* readCut(request.worldRef);
          const entries = yield* readClaims(
            request.worldRef,
            request.input.subjectKey
          );
          const claims = entries.map((entry) => entry.claim);
          const selection = yield* classifyClaims(claims);
          const frameRef = yield* Schema.decodeEffect(FrameRef)(randomUUID());
          const visible = yield* Schema.decodeEffect(VisibleFrame)({
            claims,
            contested: selection.contested,
            coverage: { _tag: claims.length === 0 ? "Unknown" : "Partial" },
            frameRef,
            scopedCorrections: yield* readScopedCorrections(
              context,
              request.worldRef,
              request.input.subjectKey
            ),
            selection: selection.selection,
            subjectKey: request.input.subjectKey,
            verification: "unverified",
            worldRef: request.worldRef,
          });
          const [clock] =
            yield* sql`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS observed_at`;
          const time = yield* Schema.decodeUnknownEffect(
            Schema.Struct({ observed_at: Instant })
          )(clock);
          const sources = [
            ...new Map(
              entries.map((entry) => [
                entry.dependency.evidenceRef,
                entry.dependency,
              ])
            ).values(),
          ];
          const readSet = yield* Schema.decodeEffect(ReadSet)({
            clockSample: { observedAt: time.observed_at, uncertaintyMillis: 1 },
            identities: [],
            membershipRevision: access.membership_revision,
            predicates: [
              {
                domain: "claims",
                predicate: "obligation.amount",
                subjectKey: request.input.subjectKey,
                version: cut.claims,
              },
            ],
            sources,
            temporalGuards: [],
          });
          const basis = yield* Schema.decodeEffect(InternalBasis)({
            cut,
            head: {
              cellEpoch: access.cell_epoch,
              generationId: access.generation_id,
              releaseDigest: access.release_digest,
              securityRevision: access.security_revision,
            },
            readSet,
            readSetDigest: yield* structuredDigest("read-set", readSet),
            worldRef: request.worldRef,
          });
          const basisJson = yield* canonicalJson(basis);
          const visibleJson = yield* canonicalJson(visible);
          yield* sql`INSERT INTO authority.frames (world_id, realm, frame_id, principal_id, purpose, subject_key, internal_basis, visible_frame, created_at)
        VALUES (${request.worldRef.worldId}, ${request.worldRef.realm}, ${frameRef}, ${context.presence.principalId},
          ${context.purpose}, ${request.input.subjectKey}, ${basisJson}::jsonb, ${visibleJson}::jsonb, clock_timestamp())`;
          for (const source of sources) {
            // Both the frame and its evidence owner target exist in this scoped snapshot.
            yield* sql`INSERT INTO authority.pins (world_id, realm, evidence_id, owner_kind, owner_id, created_at)
          VALUES (${request.worldRef.worldId}, ${request.worldRef.realm}, ${source.evidenceRef}, 'frame', ${frameRef}, clock_timestamp())`;
          }
          return visible;
        }).pipe(
          Effect.tap(() => validateContext(context)),
          withinRequestDeadline(context)
        )
      )
      .pipe(restoreSqlDefect, sanitizeSqlFailure);
    yield* authorizeWorld(context, request.worldRef);
    return yield* Schema.decodeEffect(FrameInspected)({
      _tag: "FrameInspected",
      frame,
    });
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
