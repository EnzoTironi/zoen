import {
  HistoricalContentUnavailable,
  InvalidInput,
  NotFoundOrDenied,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import { EvidenceOpened, OpenEvidence } from "@zoen/contracts/d01/operations";
import {
  Digest,
  DocumentFormat,
  DocumentText,
} from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { authorizeWorld } from "../../access/world.js";
import type { VerifiedRequestContext } from "../../ports/d01/context.js";
import { CaptureState, EvidenceState } from "../../ports/d01/persistence.js";
import {
  CaptureId,
  EvidenceObjectStore,
  ObjectLocation,
} from "../../ports/d01/storage.js";
import { digestBytes } from "../../values/canonical.js";

const EvidenceLocation = Schema.Struct({
  byte_digest: Digest,
  byte_length: Schema.Int,
  capture_id: CaptureId,
  capture_state: CaptureState,
  document_format: DocumentFormat,
  expected_digest: Digest,
  object_location: Schema.NullOr(ObjectLocation),
  state: EvidenceState,
});

const readLocation = Effect.fn("authority.evidence.readLocation")(
  function* readLocation(
    context: VerifiedRequestContext,
    request: typeof OpenEvidence.Type
  ) {
    yield* authorizeWorld(context, request.worldRef);
    const sql = yield* SqlClient.SqlClient;
    const [row] =
      yield* sql`SELECT e.byte_digest, e.state, c.state AS capture_state, c.object_location,
        c.capture_id, c.byte_length, c.expected_digest, c.document_format
      FROM authority.evidence e JOIN jobs.captures c USING (world_id, realm, capture_id)
      WHERE e.world_id = ${request.worldRef.worldId} AND e.realm = ${request.worldRef.realm} AND e.evidence_id = ${request.input.evidenceRef}`;
    if (row === undefined) {
      return yield* new NotFoundOrDenied({ code: "NOT_FOUND_OR_DENIED" });
    }
    const evidence = yield* Schema.decodeUnknownEffect(EvidenceLocation)(row);
    if (
      evidence.state !== "admitted" ||
      evidence.capture_state !== "admitted" ||
      evidence.object_location === null
    ) {
      return yield* new HistoricalContentUnavailable({
        code: "HISTORICAL_CONTENT_UNAVAILABLE",
      });
    }
    const location = evidence.object_location;
    if (
      location.worldRef.worldId !== request.worldRef.worldId ||
      location.worldRef.realm !== request.worldRef.realm ||
      location.digest !== evidence.byte_digest ||
      location.digest !== evidence.expected_digest ||
      location.captureId !== evidence.capture_id ||
      location.byteLength !== evidence.byte_length ||
      (location.documentFormat ?? "d01.json.v1") !== evidence.document_format
    ) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    return { documentFormat: evidence.document_format, location };
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);

export const openEvidence = Effect.fn("authority.evidence.openEvidence")(
  function* openEvidence(
    context: VerifiedRequestContext,
    input: typeof OpenEvidence.Type
  ) {
    const request = yield* Schema.decodeEffect(OpenEvidence)(input).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    const { documentFormat, location } = yield* readLocation(context, request);
    const store = yield* EvidenceObjectStore;
    const bytes = yield* store.read(location).pipe(
      Effect.mapError(
        () =>
          new HistoricalContentUnavailable({
            code: "HISTORICAL_CONTENT_UNAVAILABLE",
          })
      )
    );
    if (
      bytes.byteLength !== location.byteLength ||
      digestBytes(bytes) !== location.digest
    ) {
      return yield* new HistoricalContentUnavailable({
        code: "HISTORICAL_CONTENT_UNAVAILABLE",
      });
    }
    const document = yield* Effect.try({
      catch: () =>
        new HistoricalContentUnavailable({
          code: "HISTORICAL_CONTENT_UNAVAILABLE",
        }),
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    });
    const current = yield* readLocation(context, request);
    if (
      current.documentFormat !== documentFormat ||
      current.location.digest !== location.digest ||
      current.location.key !== location.key ||
      current.location.versionId !== location.versionId ||
      current.location.captureId !== location.captureId ||
      current.location.byteLength !== location.byteLength
    ) {
      return yield* new HistoricalContentUnavailable({
        code: "HISTORICAL_CONTENT_UNAVAILABLE",
      });
    }
    return yield* Schema.decodeEffect(EvidenceOpened)({
      _tag: "EvidenceOpened",
      document: yield* Schema.decodeEffect(DocumentText)(document),
      evidenceRef: request.input.evidenceRef,
      mediaType:
        documentFormat === "d01.csv.v1" ? "text/csv" : "application/json",
    }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
