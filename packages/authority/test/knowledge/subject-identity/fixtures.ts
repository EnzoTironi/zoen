import { VisibleClaim } from "@zoen/contracts/d01/evidence";
import { DateInterval, SubjectKey } from "@zoen/contracts/d01/values";
import { Schema } from "effect";

import {
  IdentityDecision,
  IdentityScope,
} from "../../../src/knowledge/subject-identity/pure/events.js";

const decodeSubjectKey = Schema.decodeSync(SubjectKey);

export const id = (number: number) =>
  `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
export const period = (from = "2026-09-01", to = "2026-10-01") =>
  Schema.decodeSync(DateInterval)({ _tag: "DateInterval", from, to });
export const scope = Schema.decodeSync(IdentityScope)({
  principalRef: id(1),
  purpose: "personal-records",
  worldRef: { realm: "live", worldId: id(2) },
});
export const decision = (
  revision: number,
  effects: readonly unknown[],
  fields: Readonly<Record<string, unknown>> = {}
) =>
  Schema.decodeUnknownSync(IdentityDecision)({
    authoredBy: scope.principalRef,
    decisionRef: id(1000 + revision),
    effectItems: effects,
    interval: period(),
    kind: "resolution",
    purpose: scope.purpose,
    revision: String(revision),
    targetDecisionRef: null,
    worldRef: scope.worldRef,
    ...fields,
  });
export const assertEdge = (
  index: number,
  left: string,
  right: string,
  relation = "same-as",
  interval = period()
) => ({
  _tag: "Assert" as const,
  assertionRef: id(2000 + index),
  effectRef: id(3000 + index),
  interval,
  left: decodeSubjectKey(left),
  relation,
  right: decodeSubjectKey(right),
});

export const claim = (
  index: number,
  key: string,
  fields: Readonly<Record<string, unknown>> = {}
) =>
  Schema.decodeSync(VisibleClaim)({
    claimRef: id(10_000 + index),
    evidenceRef: id(11_000 + index),
    predicate: "obligation.amount",
    recordId: `row-${index}`,
    recordIndex: 0,
    source: {
      externalId: `source-${index}`,
      label: "Ledger",
      namespace: "manual",
      revision: "1",
    },
    sourceRef: id(12_000 + index),
    subjectKey: decodeSubjectKey(key),
    validTime: period(),
    value: { _tag: "Known", amount: "100", currency: "BRL" },
    verification: "unverified",
    ...fields,
  });
