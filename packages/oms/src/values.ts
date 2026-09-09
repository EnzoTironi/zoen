import { Schema } from "effect";

/** Match contracts exact-parse options for OMS registry cards. */
export const exact = {
  parseOptions: { onExcessProperty: "error" },
} as const;

export const OmsSchemaVersion = Schema.Literal("oms.v1");
export type OmsSchemaVersion = typeof OmsSchemaVersion.Type;

export const TypeId = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(128),
  Schema.isPattern(/^[A-Za-z][A-Za-z0-9._-]*$/u)
).pipe(Schema.brand("zoen/oms/TypeId"));
export type TypeId = typeof TypeId.Type;

export const PackId = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(64),
  Schema.isPattern(/^[a-z][a-z0-9-]*$/u)
).pipe(Schema.brand("zoen/oms/PackId"));
export type PackId = typeof PackId.Type;

export const RegistryVersion = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(32),
  Schema.isPattern(/^\d+\.\d+\.\d+$/u)
).pipe(Schema.brand("zoen/oms/RegistryVersion"));
export type RegistryVersion = typeof RegistryVersion.Type;

export const PropertyName = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(64),
  Schema.isPattern(/^[a-z][a-zA-Z0-9]*$/u)
).pipe(Schema.brand("zoen/oms/PropertyName"));
export type PropertyName = typeof PropertyName.Type;

export const PropertyValueKind = Schema.Literals([
  "string",
  "boolean",
  "integer",
  "decimal",
  "uuid",
  "instant",
  "json",
  "ref",
]);
export type PropertyValueKind = typeof PropertyValueKind.Type;

export const Cardinality = Schema.Literals([
  "one",
  "zero-or-one",
  "one-or-more",
  "zero-or-more",
]);
export type Cardinality = typeof Cardinality.Type;

export const ActionMode = Schema.Literals(["read", "mutation"]);
export type ActionMode = typeof ActionMode.Type;

export const RuntimeBinding = Schema.Literals([
  "semantic-executor",
  "action-runtime",
]);
export type RuntimeBinding = typeof RuntimeBinding.Type;
