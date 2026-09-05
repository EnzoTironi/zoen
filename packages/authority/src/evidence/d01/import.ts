import { randomUUID } from "node:crypto";

import type { D01Error } from "@zoen/contracts/d01/errors";
import {
  Conflict,
  HistoricalContentUnavailable,
  InvalidInput,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import type { ImportDocument } from "@zoen/contracts/d01/evidence";
import {
  EvidenceImported,
  ImportEvidence,
} from "@zoen/contracts/d01/operations";
import {
  ClaimRef,
  Digest,
  EvidenceRef,
  SourceRef,
} from "@zoen/contracts/d01/values";
import type { ReceiptRef } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";
import type { SchemaError } from "effect/Schema";
import { SqlClient } from "effect/unstable/sql";
import type { SqlError } from "effect/unstable/sql/SqlError";

import { bindWorldIntent } from "../../commit/intent.js";
import { commitMutation } from "../../commit/mutation.js";
import type { MutationOutcome } from "../../commit/mutation.js";
import type { VerifiedRequestContext } from "../../ports/d01/context.js";
import { EvidenceState } from "../../ports/d01/persistence.js";
import { parseDocumentText } from "../../values/json.js";
import { lockCapture, reserveCapture, stageCapture } from "./capture.js";
import type { CaptureReservation } from "./capture.js";
import { requireImportPolicy } from "./policy.js";

const ExistingEvidence = Schema.Struct({
  byte_digest: Digest,
  evidence_id: EvidenceRef,
  state: EvidenceState,
});

const writeAdmission = Effect.fn("authority.evidence.writeAdmission")(
  function* writeAdmission(
    context: VerifiedRequestContext,
    reservation: CaptureReservation,
    document: ImportDocument,
    receiptRef: typeof ReceiptRef.Type
  ): Effect.fn.Return<
    MutationOutcome,
    D01Error | SqlError | SchemaError,
    SqlClient.SqlClient
  > {
    const sql = yield* SqlClient.SqlClient;
    const world = reservation.worldRef;
    const capture = yield* lockCapture(context, reservation);
    if (capture.state !== "uploaded" || capture.object_location === null) {
      return yield* new Unavailable({ code: "UNAVAILABLE" });
    }
    const [found] = yield* sql`SELECT source_id FROM authority.sources
      WHERE world_id = ${world.worldId} AND realm = ${world.realm}
        AND namespace = ${document.source.namespace} AND external_id = ${document.source.externalId}`;
    const sourceRef =
      found === undefined
        ? yield* Schema.decodeEffect(SourceRef)(randomUUID())
        : (yield* Schema.decodeUnknownEffect(
            Schema.Struct({ source_id: SourceRef })
          )(found)).source_id;
    if (found === undefined) {
      yield* sql`INSERT INTO authority.sources (world_id, realm, source_id, namespace, external_id, label)
        VALUES (${world.worldId}, ${world.realm}, ${sourceRef}, ${document.source.namespace}, ${document.source.externalId}, ${document.source.label})`;
    }
    const [existing] =
      yield* sql`SELECT byte_digest, evidence_id, state FROM authority.evidence
      WHERE world_id = ${world.worldId} AND realm = ${world.realm}
        AND source_id = ${sourceRef} AND source_revision = ${document.source.revision}`;
    if (existing !== undefined) {
      const previous =
        yield* Schema.decodeUnknownEffect(ExistingEvidence)(existing);
      if (previous.byte_digest !== reservation.expectedDigest) {
        return yield* new Conflict({ code: "CONFLICT" });
      }
      if (previous.state !== "admitted") {
        return yield* new HistoricalContentUnavailable({
          code: "HISTORICAL_CONTENT_UNAVAILABLE",
        });
      }
      return {
        changedDomains: [],
        result: {
          _tag: "EvidenceImported",
          evidenceRef: previous.evidence_id,
          receiptRef,
          sourceRef,
        },
      };
    }
    const evidenceRef = yield* Schema.decodeEffect(EvidenceRef)(randomUUID());
    yield* sql`INSERT INTO authority.evidence
      (world_id, realm, evidence_id, capture_id, source_id, source_revision, source_label, byte_digest, state, admitted_receipt_id)
      VALUES (${world.worldId}, ${world.realm}, ${evidenceRef}, ${reservation.captureId}, ${sourceRef},
        ${document.source.revision}, ${document.source.label}, ${reservation.expectedDigest}, 'admitted', ${receiptRef})`;
    for (const [index, record] of document.records.entries()) {
      const claimRef = yield* Schema.decodeEffect(ClaimRef)(randomUUID());
      const from =
        record.validTime._tag === "DateInterval" ? record.validTime.from : null;
      const to =
        record.validTime._tag === "DateInterval" ? record.validTime.to : null;
      const amount = record.value._tag === "Known" ? record.value.amount : null;
      const currency =
        record.value._tag === "Known" ? record.value.currency : null;
      yield* sql`INSERT INTO authority.claims
        (world_id, realm, claim_id, evidence_id, source_id, external_id, subject_key, predicate,
         record_index, valid_from, valid_to, value_tag, amount, currency, introduced_receipt_id)
        VALUES (${world.worldId}, ${world.realm}, ${claimRef}, ${evidenceRef}, ${sourceRef}, ${record.externalId},
          ${record.subjectKey}, ${record.predicate}, ${index}, ${from}::date, ${to}::date,
          ${record.value._tag}, ${amount}::numeric, ${currency}, ${receiptRef})`;
    }
    // The owner is the evidence inserted immediately above in the same World transaction.
    yield* sql`INSERT INTO authority.pins (world_id, realm, evidence_id, owner_kind, owner_id, created_at)
      VALUES (${world.worldId}, ${world.realm}, ${evidenceRef}, 'evidence', ${evidenceRef}, clock_timestamp())`;
    yield* sql`UPDATE jobs.captures SET state = 'admitted'
      WHERE world_id = ${world.worldId} AND realm = ${world.realm} AND capture_id = ${reservation.captureId} AND fence = ${reservation.fence}`;
    return {
      changedDomains:
        found === undefined
          ? ["claims", "evidence", "sources"]
          : ["claims", "evidence"],
      result: { _tag: "EvidenceImported", evidenceRef, receiptRef, sourceRef },
    };
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);

export const importEvidence = Effect.fn("authority.evidence.importEvidence")(
  function* importEvidence(
    context: VerifiedRequestContext,
    input: typeof ImportEvidence.Type
  ) {
    const request = yield* Schema.decodeEffect(ImportEvidence)(input).pipe(
      Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
    );
    yield* requireImportPolicy(context, request.worldRef);
    const document = yield* parseDocumentText(request.input.document);
    if (
      new Set(document.records.map((record) => record.externalId)).size !==
      document.records.length
    ) {
      return yield* new InvalidInput({ code: "INVALID_INPUT" });
    }
    const bound = yield* bindWorldIntent(request);
    const bytes = new TextEncoder().encode(request.input.document);
    const reservation = yield* reserveCapture(context, request.worldRef, bytes);
    yield* stageCapture(context, reservation, bytes);
    const result = yield* commitMutation(context, bound, {
      apply: (receiptRef) =>
        writeAdmission(context, reservation, document, receiptRef),
      basis: null,
      domains: ["claims", "evidence", "sources"],
    });
    return yield* Schema.decodeUnknownEffect(EvidenceImported)(result).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
  }
);
