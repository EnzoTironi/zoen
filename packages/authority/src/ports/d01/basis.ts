import {
  Digest,
  EvidenceRef,
  Instant,
  RecordKey,
  Revision,
  SourceRef,
  SourceRevision,
  SubjectKey,
  WorldRef,
  exact,
} from "@zoen/contracts/d01/values";
import { Schema } from "effect";

export const DomainKey = Schema.Literals([
  "membership",
  "sources",
  "evidence",
  "claims",
  "cases",
]);
export const DomainCut = Schema.Record(DomainKey, Revision).annotate(exact);
export type DomainCut = typeof DomainCut.Type;
export const Head = Schema.Struct({
  cellEpoch: Revision,
  generationId: Schema.String.check(Schema.isUUID()),
  releaseDigest: Digest,
  securityRevision: Revision,
}).annotate(exact);
export const SourceDependency = Schema.Struct({
  byteDigest: Digest,
  evidenceRef: EvidenceRef,
  revision: SourceRevision,
  sourceRef: SourceRef,
}).annotate(exact);
export const PredicateDependency = Schema.Struct({
  domain: Schema.Literal("claims"),
  predicate: Schema.Literal("obligation.amount"),
  subjectKey: SubjectKey,
  version: Revision,
}).annotate(exact);
export const IdentityDependency = Schema.Struct({
  namespace: RecordKey,
  revision: Revision,
  subjectKey: SubjectKey,
}).annotate(exact);
export const ClockSample = Schema.Struct({
  observedAt: Instant,
  uncertaintyMillis: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
}).annotate(exact);
export const TemporalGuard = Schema.Struct({
  notAfter: Schema.NullOr(Instant),
  notBefore: Schema.NullOr(Instant),
})
  .check(
    Schema.makeFilter(
      (guard) =>
        guard.notBefore === null ||
        guard.notAfter === null ||
        guard.notBefore < guard.notAfter
    )
  )
  .annotate(exact);
export const ReadSet = Schema.Struct({
  clockSample: ClockSample,
  identities: Schema.Array(IdentityDependency),
  membershipRevision: Revision,
  predicates: Schema.Array(PredicateDependency),
  sources: Schema.Array(SourceDependency),
  temporalGuards: Schema.Array(TemporalGuard),
}).annotate(exact);
export const InternalBasis = Schema.Struct({
  cut: DomainCut,
  head: Head,
  readSet: ReadSet,
  readSetDigest: Digest,
  worldRef: WorldRef,
}).annotate(exact);
export type InternalBasis = typeof InternalBasis.Type;
