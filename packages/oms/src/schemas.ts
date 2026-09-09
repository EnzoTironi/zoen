import { Schema } from "effect";

import {
  ActionMode,
  Cardinality,
  PackId,
  PropertyName,
  PropertyValueKind,
  RuntimeBinding,
  TypeId,
  exact,
} from "./values.js";

export const PropertyType = Schema.Struct({
  description: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(512)
  ),
  kind: PropertyValueKind,
  name: PropertyName,
  optional: Schema.Boolean,
  refTypeId: Schema.NullOr(TypeId),
}).annotate(exact);
export type PropertyType = typeof PropertyType.Type;

export const ObjectType = Schema.Struct({
  description: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1024)
  ),
  glossaryTerm: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  id: TypeId,
  packId: PackId,
  properties: Schema.Array(PropertyType).check(Schema.isMaxLength(64)),
  version: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(32)),
}).annotate(exact);
export type ObjectType = typeof ObjectType.Type;

export const LinkType = Schema.Struct({
  cardinalityFrom: Cardinality,
  cardinalityTo: Cardinality,
  description: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1024)
  ),
  fromTypeId: TypeId,
  glossaryTerm: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  id: TypeId,
  packId: PackId,
  toTypeId: TypeId,
  version: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(32)),
}).annotate(exact);
export type LinkType = typeof LinkType.Type;

export const ActionParameter = Schema.Struct({
  description: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(512)
  ),
  kind: PropertyValueKind,
  name: PropertyName,
  optional: Schema.Boolean,
  refTypeId: Schema.NullOr(TypeId),
}).annotate(exact);
export type ActionParameter = typeof ActionParameter.Type;

/**
 * Placeholder submission criteria for W1 — Engine (W2) will evaluate these.
 * Fail-closed intent is declared here; no runtime grant path in OMS.
 */
export const SubmissionCriteriaStub = Schema.Struct({
  notes: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(1024)),
  requireAuthenticated: Schema.Boolean,
  requireOwner: Schema.Boolean,
  requireWorldScope: Schema.Boolean,
}).annotate(exact);
export type SubmissionCriteriaStub = typeof SubmissionCriteriaStub.Type;

/** Declared ontology edit intent — not executed until Action runtime (W2). */
export const EditIntent = Schema.Struct({
  creates: Schema.Array(TypeId).check(Schema.isMaxLength(32)),
  deletes: Schema.Array(TypeId).check(Schema.isMaxLength(32)),
  linkCreates: Schema.Array(TypeId).check(Schema.isMaxLength(32)),
  updates: Schema.Array(TypeId).check(Schema.isMaxLength(32)),
}).annotate(exact);
export type EditIntent = typeof EditIntent.Type;

export const ActionType = Schema.Struct({
  description: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1024)
  ),
  editIntent: EditIntent,
  glossaryTerm: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  id: TypeId,
  mode: ActionMode,
  packId: PackId,
  parameters: Schema.Array(ActionParameter).check(Schema.isMaxLength(32)),
  runtimeBinding: RuntimeBinding,
  /** Tip SemanticRequest.operation literal this ActionType seeds. */
  semanticOperation: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(128)
  ),
  submissionCriteria: SubmissionCriteriaStub,
  version: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(32)),
}).annotate(exact);
export type ActionType = typeof ActionType.Type;
