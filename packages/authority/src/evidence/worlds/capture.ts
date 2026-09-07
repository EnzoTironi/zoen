import { randomUUID } from "node:crypto";

import {
  Expired,
  InvalidInput,
  Unavailable,
} from "@zoen/contracts/worlds/errors";
import {
  D01_LIMITS,
  Digest,
  DocumentFormat,
  Instant,
  Revision,
  WorldRef,
  exact,
} from "@zoen/contracts/worlds/values";
import { Effect, Schema, Stream } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  validateContext,
  withinRequestDeadline,
} from "../../access/context.js";
import { serializable } from "../../commit/transaction.js";
import type { VerifiedRequestContext } from "../../ports/worlds/context.js";
import { CaptureState } from "../../ports/worlds/persistence.js";
import {
  CaptureId,
  EvidenceObjectStore,
  ObjectLocation,
} from "../../ports/worlds/storage.js";
import { canonicalJson, digestBytes } from "../../values/canonical.js";
import { requireImportPolicy } from "./policy.js";

export const CaptureReservation = Schema.Struct({
  captureId: CaptureId,
  documentFormat: DocumentFormat,
  expectedBytes: Schema.Int.check(
    Schema.isGreaterThan(0),
    Schema.isLessThanOrEqualTo(D01_LIMITS.documentBytes)
  ),
  expectedDigest: Digest,
  expiresAt: Instant,
  fence: Revision,
  worldRef: WorldRef,
}).annotate(exact);
export type CaptureReservation = typeof CaptureReservation.Type;

const CaptureRow = Schema.Struct({
  byte_length: CaptureReservation.fields.expectedBytes,
  document_format: DocumentFormat,
  expected_digest: Digest,
  expired: Schema.Boolean,
  fence: Revision,
  object_location: Schema.NullOr(ObjectLocation),
  state: CaptureState,
}).annotate(exact);

export const reserveCapture = Effect.fn("authority.evidence.reserveCapture")(
  function* reserveCapture(
    context: VerifiedRequestContext,
    world: WorldRef,
    bytes: Uint8Array,
    format: DocumentFormat = "worlds.json.v1"
  ) {
    yield* requireImportPolicy(context, world);
    if (bytes.byteLength === 0 || bytes.byteLength > D01_LIMITS.documentBytes) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    const documentFormat = yield* Schema.decodeEffect(DocumentFormat)(
      format
    ).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
    const captureId = yield* Schema.decodeEffect(CaptureId)(randomUUID()).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
    const digest = digestBytes(bytes);
    const sql = yield* SqlClient.SqlClient;
    return yield* serializable(
      Effect.gen(function* reserveUpload() {
        // Closing holds FOR UPDATE; a reservation cannot sneak in after its cut.
        yield* sql`SELECT world_id FROM authority.worlds
          WHERE world_id = ${world.worldId} AND realm = ${world.realm} FOR SHARE`;
        yield* requireImportPolicy(context, world);
        const [row] = yield* sql`
        INSERT INTO jobs.captures
          (world_id, realm, capture_id, principal_id, state, object_location,
           expected_digest, byte_length, expires_at, fence, document_format)
        VALUES (${world.worldId}, ${world.realm}, ${captureId}, ${context.presence.principalId},
          'reserved', NULL, ${digest}, ${bytes.byteLength}, clock_timestamp() + ${D01_LIMITS.stagingSeconds} * interval '1 second', 0, ${documentFormat})
        RETURNING to_char(expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS expires_at
      `;
        const deadline = yield* Schema.decodeUnknownEffect(
          Schema.Struct({ expires_at: Instant })
        )(row).pipe(
          Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
        );
        return yield* Schema.decodeEffect(CaptureReservation)({
          captureId,
          documentFormat,
          expectedBytes: bytes.byteLength,
          expectedDigest: digest,
          expiresAt: deadline.expires_at,
          fence: "0",
          worldRef: world,
        }).pipe(
          Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
        );
      }).pipe(
        Effect.tap(() => validateContext(context)),
        withinRequestDeadline(context)
      )
    );
  }
);

export const lockCapture = Effect.fn("authority.evidence.lockCapture")(
  function* lockCapture(
    context: VerifiedRequestContext,
    reservation: CaptureReservation
  ) {
    const sql = yield* SqlClient.SqlClient;
    const [row] = yield* sql`
      SELECT byte_length, document_format, expected_digest, expires_at <= clock_timestamp() AS expired,
        fence::text, object_location, state
      FROM jobs.captures
      WHERE world_id = ${reservation.worldRef.worldId} AND realm = ${reservation.worldRef.realm}
        AND capture_id = ${reservation.captureId} AND principal_id = ${context.presence.principalId}
      FOR UPDATE
    `;
    const capture = yield* Schema.decodeUnknownEffect(CaptureRow)(row).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
    if (
      capture.expired ||
      capture.fence !== reservation.fence ||
      capture.state === "cleanup_pending" ||
      capture.state === "removed"
    ) {
      return yield* new Expired({ code: "EXPIRED" });
    }
    if (
      capture.byte_length !== reservation.expectedBytes ||
      capture.expected_digest !== reservation.expectedDigest ||
      capture.document_format !== reservation.documentFormat
    ) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    if (capture.object_location !== null) {
      const location = capture.object_location;
      if (
        location.captureId !== reservation.captureId ||
        location.worldRef.worldId !== reservation.worldRef.worldId ||
        location.worldRef.realm !== reservation.worldRef.realm ||
        location.digest !== reservation.expectedDigest ||
        location.byteLength !== reservation.expectedBytes ||
        (location.documentFormat ?? "worlds.json.v1") !==
          reservation.documentFormat
      ) {
        return yield* new Unavailable({ code: "UNAVAILABLE" });
      }
    }
    return capture;
  }
);

export const stageCapture = Effect.fn("authority.evidence.stageCapture")(
  function* stageCapture(
    context: VerifiedRequestContext,
    reservation: CaptureReservation,
    bytes: Uint8Array
  ) {
    yield* requireImportPolicy(context, reservation.worldRef);
    if (
      bytes.byteLength !== reservation.expectedBytes ||
      digestBytes(bytes) !== reservation.expectedDigest
    ) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    const store = yield* EvidenceObjectStore;
    const location = yield* store
      .stageDocument({
        captureId: reservation.captureId,
        content: Stream.make(bytes),
        documentFormat: reservation.documentFormat,
        expectedBytes: reservation.expectedBytes,
        expectedDigest: reservation.expectedDigest,
        worldRef: reservation.worldRef,
      })
      .pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
    const checked = yield* Schema.decodeEffect(ObjectLocation)(location).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
    if (
      checked.captureId !== reservation.captureId ||
      checked.worldRef.worldId !== reservation.worldRef.worldId ||
      checked.worldRef.realm !== reservation.worldRef.realm ||
      checked.digest !== reservation.expectedDigest ||
      checked.byteLength !== reservation.expectedBytes ||
      checked.documentFormat !== reservation.documentFormat
    ) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    const json = yield* canonicalJson(checked);
    const sql = yield* SqlClient.SqlClient;
    yield* serializable(
      Effect.gen(function* confirmUpload() {
        yield* requireImportPolicy(context, reservation.worldRef);
        const capture = yield* lockCapture(context, reservation);
        if (capture.state !== "reserved") {
          return yield* new Unavailable({ code: "UNAVAILABLE" });
        }
        yield* sql`
        UPDATE jobs.captures SET state = 'uploaded', object_location = ${json}::jsonb
        WHERE world_id = ${reservation.worldRef.worldId} AND realm = ${reservation.worldRef.realm}
          AND capture_id = ${reservation.captureId} AND fence = ${reservation.fence}
      `;
        return checked;
      }).pipe(
        Effect.tap(() => validateContext(context)),
        withinRequestDeadline(context)
      )
    );
    return checked;
  }
);
