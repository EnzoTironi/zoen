import { PrincipalRef } from "@zoen/contracts/sharing/operations";
import {
  DateInterval,
  Digest,
  EvidenceRef,
  Instant,
  Purpose,
  RecordKey,
  Revision,
  SourceRef,
  SourceRevision,
  SubjectKey,
  WorldRef,
  exact,
} from "@zoen/contracts/worlds/values";
import { Schema } from "effect";

export const LegacyDomainKey = Schema.Literals([
  "membership",
  "sources",
  "evidence",
  "claims",
  "cases",
]);
export const LegacyDomainCut = Schema.Record(
  LegacyDomainKey,
  Revision
).annotate(exact);
export const DomainKey = Schema.Literals([
  ...LegacyDomainKey.literals,
  "identity",
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
export const LegacyIdentityDependency = Schema.Struct({
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
const readSetFields = {
  clockSample: ClockSample,
  membershipRevision: Revision,
  predicates: Schema.Array(PredicateDependency),
  sources: Schema.Array(SourceDependency),
  temporalGuards: Schema.Array(TemporalGuard),
};
export const LegacyReadSet = Schema.Struct({
  ...readSetFields,
  identities: Schema.Array(LegacyIdentityDependency),
}).annotate(exact);
export type LegacyReadSet = typeof LegacyReadSet.Type;

const graphAnchors = Schema.Array(SubjectKey).check(
  Schema.isMinLength(1),
  Schema.isMaxLength(32),
  Schema.makeFilter((anchors) =>
    anchors.every((anchor, index) => {
      const previous = anchors[index - 1];
      return previous === undefined || previous < anchor;
    })
  )
);
export const SubjectIdentityGraph = Schema.TaggedStruct(
  "SubjectIdentityGraph",
  {
    anchors: graphAnchors,
    closureAnchors: graphAnchors,
    interval: DateInterval,
    principalRef: PrincipalRef,
    purpose: Purpose,
    revision: Revision,
  }
)
  .check(
    Schema.makeFilter((dependency) =>
      dependency.anchors.every((anchor) =>
        dependency.closureAnchors.includes(anchor)
      )
    )
  )
  .annotate(exact);
export const IdentityDependency = SubjectIdentityGraph;
export const CurrentReadSet = Schema.Struct({
  ...readSetFields,
  identities: Schema.Array(IdentityDependency),
  schemaVersion: Schema.Literal("authority.read-set.v2"),
}).annotate(exact);
export type CurrentReadSet = typeof CurrentReadSet.Type;
export const ReadSet = CurrentReadSet;

const basisFields = {
  head: Head,
  readSetDigest: Digest,
  worldRef: WorldRef,
};
export const LegacyInternalBasis = Schema.Struct({
  ...basisFields,
  cut: LegacyDomainCut,
  readSet: LegacyReadSet,
}).annotate(exact);
export type LegacyInternalBasis = typeof LegacyInternalBasis.Type;
export const CurrentInternalBasis = Schema.Struct({
  ...basisFields,
  cut: DomainCut,
  readSet: CurrentReadSet,
  schemaVersion: Schema.Literal("authority.basis.v2"),
}).annotate(exact);
export type CurrentInternalBasis = typeof CurrentInternalBasis.Type;
export const InternalBasis = Schema.Union([
  LegacyInternalBasis,
  CurrentInternalBasis,
]);
export type InternalBasis = typeof InternalBasis.Type;
