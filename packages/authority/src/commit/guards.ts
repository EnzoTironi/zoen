import { Stale, Unavailable } from "@zoen/contracts/d01/errors";
import { Instant, Revision, exact } from "@zoen/contracts/d01/values";
import { DateTime, Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  DomainCut,
  DomainKey,
  InternalBasis,
  SourceDependency,
} from "../ports/d01/basis.js";
import { structuredDigest } from "../values/canonical.js";

const DomainRow = Schema.Struct({
  domain_key: DomainKey,
  version: Revision,
}).annotate(exact);

export const readCut = Effect.fn("authority.commit.readCut")(function* readCut(
  world: InternalBasis["worldRef"]
) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`
    SELECT domain_key, version::text FROM authority.domains
    WHERE world_id = ${world.worldId} AND realm = ${world.realm}
    ORDER BY domain_key COLLATE "C"
  `;
  const domains = yield* Schema.decodeUnknownEffect(Schema.Array(DomainRow))(
    rows
  ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
  return yield* Schema.decodeUnknownEffect(DomainCut)(
    Object.fromEntries(domains.map((row) => [row.domain_key, row.version]))
  ).pipe(Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" })));
});

export const temporalGuardsHold = (
  readSet: InternalBasis["readSet"],
  now: typeof Instant.Type
): boolean => {
  const current = DateTime.toEpochMillis(DateTime.makeUnsafe(now));
  const earliest = current - readSet.clockSample.uncertaintyMillis;
  const latest = current + readSet.clockSample.uncertaintyMillis;
  return readSet.temporalGuards.every(
    (guard) =>
      (guard.notBefore === null ||
        earliest >=
          DateTime.toEpochMillis(DateTime.makeUnsafe(guard.notBefore))) &&
      (guard.notAfter === null ||
        latest < DateTime.toEpochMillis(DateTime.makeUnsafe(guard.notAfter)))
  );
};

export const validateBasis = Effect.fn("authority.commit.validateBasis")(
  function* validateBasis(
    basis: InternalBasis,
    current: {
      readonly worldRef: InternalBasis["worldRef"];
      readonly head: InternalBasis["head"];
      readonly cut: DomainCut;
      readonly membershipRevision: typeof Revision.Type;
    }
  ) {
    const saved = yield* Schema.decodeEffect(InternalBasis)(basis).pipe(
      Effect.mapError(() => new Stale({ code: "STALE" }))
    );
    const digest = yield* structuredDigest("read-set", saved.readSet);
    if (
      digest !== saved.readSetDigest ||
      saved.worldRef.worldId !== current.worldRef.worldId ||
      saved.worldRef.realm !== current.worldRef.realm ||
      saved.head.cellEpoch !== current.head.cellEpoch ||
      saved.head.releaseDigest !== current.head.releaseDigest ||
      saved.head.generationId !== current.head.generationId ||
      saved.head.securityRevision !== current.head.securityRevision ||
      saved.readSet.membershipRevision !== current.membershipRevision ||
      saved.readSet.identities.length !== 0 ||
      DomainKey.literals.some(
        (domain) => saved.cut[domain] !== current.cut[domain]
      ) ||
      saved.readSet.predicates.some(
        (predicate) => predicate.version !== current.cut.claims
      )
    ) {
      return yield* new Stale({ code: "STALE" });
    }
    const sql = yield* SqlClient.SqlClient;
    for (const source of saved.readSet.sources) {
      const [row] = yield* sql`
        SELECT source_id AS "sourceRef", evidence_id AS "evidenceRef",
          source_revision AS revision, byte_digest AS "byteDigest"
        FROM authority.evidence
        WHERE world_id = ${current.worldRef.worldId} AND realm = ${current.worldRef.realm}
          AND evidence_id = ${source.evidenceRef} AND state = 'admitted'
      `;
      const found = yield* Schema.decodeUnknownEffect(SourceDependency)(
        row
      ).pipe(Effect.mapError(() => new Stale({ code: "STALE" })));
      if (
        found.sourceRef !== source.sourceRef ||
        found.revision !== source.revision ||
        found.byteDigest !== source.byteDigest
      ) {
        return yield* new Stale({ code: "STALE" });
      }
    }
    const [time] = yield* sql`
      SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS now
    `;
    const clock = yield* Schema.decodeUnknownEffect(
      Schema.Struct({ now: Instant })
    )(time).pipe(
      Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
    );
    if (!temporalGuardsHold(saved.readSet, clock.now)) {
      return yield* new Stale({ code: "STALE" });
    }
    return saved;
  }
);
