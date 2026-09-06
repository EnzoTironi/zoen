import { randomUUID } from "node:crypto";

import {
  InvalidInput,
  QuotaExceeded,
  Unavailable,
} from "@zoen/contracts/d01/errors";
import type { VisibleClaim } from "@zoen/contracts/d01/evidence";
import {
  DateInterval,
  FrameRef,
  Instant,
  SubjectKey,
} from "@zoen/contracts/d01/values";
import type { Purpose, WorldRef } from "@zoen/contracts/d01/values";
import { PrincipalRef } from "@zoen/contracts/sharing/operations";
import {
  IdentityFrame,
  IdentityRecoveryFrame,
} from "@zoen/contracts/subject-identity/frame";
import {
  IdentityDecisionRef,
  IdentitySeeds,
} from "@zoen/contracts/subject-identity/values";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  CurrentInternalBasis,
  IdentityDependency,
  ReadSet,
  SourceDependency,
} from "../../../ports/d01/basis.js";
import type { DomainCut } from "../../../ports/d01/basis.js";
import { canonicalJson, structuredDigest } from "../../../values/canonical.js";
import {
  maximalIdentityCells,
  validateComparisonClaims,
} from "../pure/cells.js";
import { compareIdentityCells } from "../pure/comparison.js";
import type { IdentityProjection } from "../pure/events.js";
import { closeIdentity } from "../pure/graph.js";

export const primarySubjectKey = (
  anchors: readonly (typeof SubjectKey.Type)[]
): typeof SubjectKey.Type => [...anchors].toSorted()[0]!;

export const buildIdentityDependency = Effect.fn(
  "subjectIdentity.buildDependency"
)(function* buildIdentityDependency(input: {
  readonly anchors: readonly (typeof SubjectKey.Type)[];
  readonly closureAnchors: readonly (typeof SubjectKey.Type)[];
  readonly interval: typeof DateInterval.Type;
  readonly principalRef: typeof PrincipalRef.Type;
  readonly purpose: typeof Purpose.Type;
  readonly revision: DomainCut["identity"];
}) {
  return yield* Schema.decodeEffect(IdentityDependency)({
    _tag: "SubjectIdentityGraph",
    anchors: [...input.anchors].toSorted(),
    closureAnchors: [...input.closureAnchors].toSorted(),
    interval: input.interval,
    principalRef: input.principalRef,
    purpose: input.purpose,
    revision: input.revision,
  }).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
});

export const buildComparisonFrame = Effect.fn(
  "subjectIdentity.buildComparisonFrame"
)(function* buildComparisonFrame(input: {
  readonly claims: readonly VisibleClaim[];
  readonly cut: DomainCut;
  readonly interval: typeof DateInterval.Type;
  readonly membershipRevision: CurrentInternalBasis["readSet"]["membershipRevision"];
  readonly principalRef: typeof PrincipalRef.Type;
  readonly projection: IdentityProjection;
  readonly purpose: typeof Purpose.Type;
  readonly seeds: typeof IdentitySeeds.Type;
  readonly sources: readonly (typeof SourceDependency.Type)[];
  readonly worldRef: WorldRef;
  readonly head: CurrentInternalBasis["head"];
}) {
  const seeds = yield* Schema.decodeEffect(IdentitySeeds)(input.seeds).pipe(
    Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" }))
  );
  const interval = yield* Schema.decodeEffect(DateInterval)(
    input.interval
  ).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
  const closure = yield* closeIdentity(input.projection, seeds, interval);
  const claims = yield* validateComparisonClaims(closure, input.claims);
  const cells = yield* maximalIdentityCells(closure, interval, claims);
  const compared = yield* compareIdentityCells(closure, cells, claims);
  const frameRef = yield* Schema.decodeEffect(FrameRef)(randomUUID());
  const frame = yield* Schema.decodeEffect(IdentityFrame)({
    assertionSegments: closure.segments,
    audience: "private-author",
    cells: compared,
    claims,
    closureAnchors: closure.anchors,
    frameRef,
    interval,
    kind: "subject-identity",
    purpose: input.purpose,
    requestedAnchors: seeds,
    schemaVersion: "subject-identity.v1",
    worldRef: input.worldRef,
  });
  const identity = yield* buildIdentityDependency({
    anchors: seeds,
    closureAnchors: closure.anchors,
    interval,
    principalRef: input.principalRef,
    purpose: input.purpose,
    revision: input.cut.identity,
  });
  const predicates = [
    ...new Map(
      closure.anchors.map((subjectKey) => [
        subjectKey,
        {
          domain: "claims" as const,
          predicate: "obligation.amount" as const,
          subjectKey,
          version: input.cut.claims,
        },
      ])
    ).values(),
  ].toSorted((left, right) => (left.subjectKey < right.subjectKey ? -1 : 1));
  const sql = yield* SqlClient.SqlClient;
  const [clock] =
    yield* sql`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS observed_at`;
  const time = yield* Schema.decodeUnknownEffect(
    Schema.Struct({ observed_at: Instant })
  )(clock).pipe(
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );
  const readSet = yield* Schema.decodeEffect(ReadSet)({
    clockSample: { observedAt: time.observed_at, uncertaintyMillis: 1 },
    identities: [identity],
    membershipRevision: input.membershipRevision,
    predicates,
    schemaVersion: "authority.read-set.v2",
    sources: input.sources,
    temporalGuards: [],
  });
  const basis = yield* Schema.decodeEffect(CurrentInternalBasis)({
    cut: input.cut,
    head: input.head,
    readSet,
    readSetDigest: yield* structuredDigest("read-set", readSet),
    schemaVersion: "authority.basis.v2",
    worldRef: input.worldRef,
  });
  return { basis, frame };
});

export const buildRecoveryFrame = Effect.fn(
  "subjectIdentity.buildRecoveryFrame"
)(function* buildRecoveryFrame(input: {
  readonly anchor: typeof SubjectKey.Type;
  readonly cut: DomainCut;
  readonly interval: typeof DateInterval.Type;
  readonly membershipRevision: CurrentInternalBasis["readSet"]["membershipRevision"];
  readonly principalRef: typeof PrincipalRef.Type;
  readonly projection: IdentityProjection;
  readonly purpose: typeof Purpose.Type;
  readonly sources: readonly (typeof SourceDependency.Type)[];
  readonly targetDecisionRef: typeof IdentityDecisionRef.Type | null;
  readonly worldRef: WorldRef;
  readonly head: CurrentInternalBasis["head"];
}) {
  const interval = yield* Schema.decodeEffect(DateInterval)(
    input.interval
  ).pipe(Effect.mapError(() => new InvalidInput({ code: "INVALID_INPUT" })));
  const closure = yield* closeIdentity(
    input.projection,
    [input.anchor],
    interval
  );
  const drafts = yield* maximalIdentityCells(closure, interval, []);
  if (drafts.length < 1) {
    return yield* new QuotaExceeded({ code: "QUOTA_EXCEEDED" });
  }
  const cells = drafts.map((cell) => ({
    ...cell.structure,
    cellRef: cell.cellRef,
  }));
  const frameRef = yield* Schema.decodeEffect(FrameRef)(randomUUID());
  const frame = yield* Schema.decodeEffect(IdentityRecoveryFrame)({
    anchor: input.anchor,
    assertionSegments: closure.segments,
    audience: "private-author",
    cells,
    closureAnchors: closure.anchors,
    comparison: "not-requested",
    frameRef,
    interval,
    kind: "subject-identity-recovery",
    purpose: input.purpose,
    schemaVersion: "subject-identity.v1",
    targetDecisionRef: input.targetDecisionRef,
    worldRef: input.worldRef,
  });
  const identity = yield* buildIdentityDependency({
    anchors: [input.anchor],
    closureAnchors: closure.anchors,
    interval,
    principalRef: input.principalRef,
    purpose: input.purpose,
    revision: input.cut.identity,
  });
  const sql = yield* SqlClient.SqlClient;
  const [clock] =
    yield* sql`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS observed_at`;
  const time = yield* Schema.decodeUnknownEffect(
    Schema.Struct({ observed_at: Instant })
  )(clock).pipe(
    Effect.mapError(() => new Unavailable({ code: "UNAVAILABLE" }))
  );
  const readSet = yield* Schema.decodeEffect(ReadSet)({
    clockSample: { observedAt: time.observed_at, uncertaintyMillis: 1 },
    identities: [identity],
    membershipRevision: input.membershipRevision,
    predicates: closure.anchors
      .map((subjectKey) => ({
        domain: "claims" as const,
        predicate: "obligation.amount" as const,
        subjectKey,
        version: input.cut.claims,
      }))
      .toSorted((left, right) => (left.subjectKey < right.subjectKey ? -1 : 1)),
    schemaVersion: "authority.read-set.v2",
    sources: input.sources,
    temporalGuards: [],
  });
  const basis = yield* Schema.decodeEffect(CurrentInternalBasis)({
    cut: input.cut,
    head: input.head,
    readSet,
    readSetDigest: yield* structuredDigest("read-set", readSet),
    schemaVersion: "authority.basis.v2",
    worldRef: input.worldRef,
  });
  return { basis, frame };
});

export const persistIdentityFrame = Effect.fn("subjectIdentity.persistFrame")(
  function* persistIdentityFrame(input: {
    readonly basis: CurrentInternalBasis;
    readonly frame: IdentityFrame | IdentityRecoveryFrame;
    readonly principalId: string;
    readonly purpose: typeof Purpose.Type;
    readonly subjectKey: typeof SubjectKey.Type;
    readonly worldRef: WorldRef;
  }) {
    const sql = yield* SqlClient.SqlClient;
    const basisJson = yield* canonicalJson(input.basis);
    const visibleJson = yield* canonicalJson(input.frame);
    yield* sql`INSERT INTO authority.frames (world_id, realm, frame_id, principal_id, purpose, subject_key, internal_basis, visible_frame, created_at)
    VALUES (${input.worldRef.worldId}, ${input.worldRef.realm}, ${input.frame.frameRef}, ${input.principalId},
      ${input.purpose}, ${input.subjectKey}, ${basisJson}::jsonb, ${visibleJson}::jsonb, clock_timestamp())`;
    for (const source of input.basis.readSet.sources) {
      yield* sql`INSERT INTO authority.pins (world_id, realm, evidence_id, owner_kind, owner_id, created_at)
      VALUES (${input.worldRef.worldId}, ${input.worldRef.realm}, ${source.evidenceRef}, 'frame', ${input.frame.frameRef}, clock_timestamp())`;
    }
  }
);
