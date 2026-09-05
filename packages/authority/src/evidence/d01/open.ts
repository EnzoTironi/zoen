import {
  HistoricalContentUnavailable,
  InvalidInput,
  NotFoundOrDenied,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import { EvidenceOpened, OpenEvidence } from "@zoen/contracts/d01/operations";
import { Digest, DocumentText } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { authorizeWorld } from "../../access/world.js";
import type { VerifiedRequestContext } from "../../ports/d01/context.js";
import { CaptureState, EvidenceState } from "../../ports/d01/persistence.js";
import {
  EvidenceObjectStore,
  ObjectLocation,
} from "../../ports/d01/storage.js";
import { digestBytes } from "../../values/canonical.js";

const EvidenceLocation = Schema.Struct({
  byte_digest: Digest,
  capture_state: CaptureState,
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
      yield* sql`SELECT e.byte_digest, e.state, c.state AS capture_state, c.object_location
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
      location.digest !== evidence.byte_digest
    ) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    return location;
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
    const location = yield* readLocation(context, request);
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
      current.digest !== location.digest ||
      current.key !== location.key ||
      current.versionId !== location.versionId
    ) {
      return yield* new HistoricalContentUnavailable({
        code: "HISTORICAL_CONTENT_UNAVAILABLE",
      });
    }
    return yield* Schema.decodeEffect(EvidenceOpened)({
      _tag: "EvidenceOpened",
      document: yield* Schema.decodeEffect(DocumentText)(document),
      evidenceRef: request.input.evidenceRef,
      mediaType: "application/json",
    }).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
