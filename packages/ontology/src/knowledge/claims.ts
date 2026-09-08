import { QuotaExceeded, Unavailable } from "@zoen/contracts/worlds/errors";
import { VisibleClaim } from "@zoen/contracts/worlds/evidence";
import {
  ClaimRef,
  Currency,
  WorldLimits,
  DecimalText,
  Digest,
  EvidenceRef,
  Label,
  LocalDate,
  RecordKey,
  SourceRef,
  SourceRevision,
  SubjectKey,
} from "@zoen/contracts/worlds/values";
import type { WorldRef } from "@zoen/contracts/worlds/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { SourceDependency } from "../ports/worlds/basis.js";
import { normalizeDecimal } from "../values/amount.js";

const ClaimRow = Schema.Struct({
  amount: Schema.NullOr(DecimalText),
  byte_digest: Digest,
  claim_id: ClaimRef,
  currency: Schema.NullOr(Currency),
  evidence_id: EvidenceRef,
  external_id: RecordKey,
  namespace: RecordKey,
  predicate: Schema.Literal("obligation.amount"),
  record_index: Schema.Int,
  source_external_id: RecordKey,
  source_id: SourceRef,
  source_label: Label,
  source_revision: SourceRevision,
  subject_key: SubjectKey,
  valid_from: Schema.NullOr(LocalDate),
  valid_to: Schema.NullOr(LocalDate),
  value_tag: Schema.Literals(["Known", "Unknown"]),
});

export const readClaims = Effect.fn("authority.knowledge.readClaims")(
  function* readClaims(world: WorldRef, subjectKey: typeof SubjectKey.Type) {
    const sql = yield* SqlClient.SqlClient;
    const raw = yield* sql`
      SELECT c.claim_id, c.evidence_id, c.source_id, c.external_id, c.subject_key, c.predicate,
        c.record_index, to_char(c.valid_from, 'YYYY-MM-DD') AS valid_from,
        to_char(c.valid_to, 'YYYY-MM-DD') AS valid_to, c.value_tag, c.amount::text, c.currency,
        s.namespace, s.external_id AS source_external_id, e.source_label, e.source_revision, e.byte_digest
      FROM authority.claims c
      JOIN authority.evidence e ON (e.world_id, e.realm, e.evidence_id, e.source_id) = (c.world_id, c.realm, c.evidence_id, c.source_id)
      JOIN authority.sources s ON (s.world_id, s.realm, s.source_id) = (c.world_id, c.realm, c.source_id)
      WHERE c.world_id = ${world.worldId} AND c.realm = ${world.realm} AND c.subject_key = ${subjectKey}
      ORDER BY s.namespace COLLATE "C", s.external_id COLLATE "C", e.source_revision COLLATE "C", c.external_id COLLATE "C", c.claim_id
      LIMIT ${WorldLimits.frameClaims + 1}
    `;
    if (raw.length > WorldLimits.frameClaims) {
      return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
    }
    const rows = yield* Schema.decodeUnknownEffect(Schema.Array(ClaimRow))(raw);
    return yield* Effect.forEach(
      Effect.fn("authority.knowledge.projectClaim")(function* projectClaim(
        row: typeof ClaimRow.Type
      ) {
        const value =
          row.value_tag === "Unknown"
            ? ({ _tag: "Unknown" } as const)
            : {
                _tag: "Known" as const,
                amount:
                  row.amount === null
                    ? null
                    : yield* normalizeDecimal(row.amount),
                currency: row.currency,
              };
        const validTime =
          row.valid_from === null && row.valid_to === null
            ? ({ _tag: "Unknown" } as const)
            : {
                _tag: "DateInterval" as const,
                from: row.valid_from,
                to: row.valid_to,
              };
        const claim = yield* Schema.decodeUnknownEffect(VisibleClaim)({
          claimRef: row.claim_id,
          evidenceRef: row.evidence_id,
          predicate: row.predicate,
          recordId: row.external_id,
          recordIndex: row.record_index,
          source: {
            externalId: row.source_external_id,
            label: row.source_label,
            namespace: row.namespace,
            revision: row.source_revision,
          },
          sourceRef: row.source_id,
          subjectKey: row.subject_key,
          validTime,
          value,
          verification: "unverified",
        });
        const dependency = yield* Schema.decodeEffect(SourceDependency)({
          byteDigest: row.byte_digest,
          evidenceRef: row.evidence_id,
          revision: row.source_revision,
          sourceRef: row.source_id,
        });
        return { claim, dependency };
      })
    )(rows);
  },
  Effect.catchTag("SchemaError", () => new Unavailable({ code: "UNAVAILABLE" }))
);
