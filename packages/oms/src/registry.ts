import { Schema } from "effect";

import { DuplicateTypeError } from "./duplicate-error.js";
import { UnknownTypeError } from "./errors.js";
import { ActionType, LinkType, ObjectType } from "./schemas.js";
import { OmsSchemaVersion, PackId, RegistryVersion, exact } from "./values.js";

export const OntologyPack = Schema.Struct({
  actionTypes: Schema.Array(ActionType).check(Schema.isMaxLength(128)),
  description: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1024)
  ),
  id: PackId,
  linkTypes: Schema.Array(LinkType).check(Schema.isMaxLength(128)),
  objectTypes: Schema.Array(ObjectType).check(Schema.isMaxLength(128)),
  version: RegistryVersion,
}).annotate(exact);
export type OntologyPack = typeof OntologyPack.Type;

export const OntologyRegistry = Schema.Struct({
  packs: Schema.Array(OntologyPack).check(
    Schema.isMinLength(1),
    Schema.isMaxLength(32)
  ),
  schemaVersion: OmsSchemaVersion,
  version: RegistryVersion,
}).annotate(exact);
export type OntologyRegistry = typeof OntologyRegistry.Type;

const decodeRegistry = Schema.decodeUnknownSync(OntologyRegistry);

export interface LoadedRegistry {
  readonly actionTypes: ReadonlyMap<string, ActionType>;
  readonly linkTypes: ReadonlyMap<string, LinkType>;
  readonly objectTypes: ReadonlyMap<string, ObjectType>;
  readonly packs: ReadonlyMap<string, OntologyPack>;
  readonly registry: OntologyRegistry;
}

const indexUnique = <T extends { readonly id: string }>(
  kind: "object" | "link" | "action",
  items: readonly T[]
): Map<string, T> => {
  const map = new Map<string, T>();
  for (const item of items) {
    if (map.has(item.id)) {
      throw new DuplicateTypeError({ kind, typeId: item.id });
    }
    map.set(item.id, item);
  }
  return map;
};

/** Validate and index a registry document (git-versioned JSON/TS seed). */
export const loadRegistry = (input: unknown): LoadedRegistry => {
  const registry = decodeRegistry(input);
  const packs = new Map<string, OntologyPack>();
  const objectTypes = new Map<string, ObjectType>();
  const linkTypes = new Map<string, LinkType>();
  const actionTypes = new Map<string, ActionType>();

  for (const pack of registry.packs) {
    if (packs.has(pack.id)) {
      throw new DuplicateTypeError({ kind: "pack", typeId: pack.id });
    }
    packs.set(pack.id, pack);

    for (const [id, type] of indexUnique("object", pack.objectTypes)) {
      if (objectTypes.has(id)) {
        throw new DuplicateTypeError({ kind: "object", typeId: id });
      }
      objectTypes.set(id, type);
    }
    for (const [id, type] of indexUnique("link", pack.linkTypes)) {
      if (linkTypes.has(id)) {
        throw new DuplicateTypeError({ kind: "link", typeId: id });
      }
      linkTypes.set(id, type);
    }
    for (const [id, type] of indexUnique("action", pack.actionTypes)) {
      if (actionTypes.has(id)) {
        throw new DuplicateTypeError({ kind: "action", typeId: id });
      }
      actionTypes.set(id, type);
    }
  }

  for (const link of linkTypes.values()) {
    if (!objectTypes.has(link.fromTypeId)) {
      throw new UnknownTypeError({
        kind: "object",
        typeId: link.fromTypeId,
      });
    }
    if (!objectTypes.has(link.toTypeId)) {
      throw new UnknownTypeError({ kind: "object", typeId: link.toTypeId });
    }
  }

  for (const action of actionTypes.values()) {
    for (const typeId of [
      ...action.editIntent.creates,
      ...action.editIntent.updates,
      ...action.editIntent.deletes,
    ]) {
      if (!objectTypes.has(typeId)) {
        throw new UnknownTypeError({ kind: "object", typeId });
      }
    }
    for (const typeId of action.editIntent.linkCreates) {
      if (!linkTypes.has(typeId)) {
        throw new UnknownTypeError({ kind: "link", typeId });
      }
    }
  }

  return { actionTypes, linkTypes, objectTypes, packs, registry };
};

export const lookupObjectType = (
  loaded: LoadedRegistry,
  typeId: string
): ObjectType => {
  const found = loaded.objectTypes.get(typeId);
  if (!found) {
    throw new UnknownTypeError({ kind: "object", typeId });
  }
  return found;
};

export const lookupLinkType = (
  loaded: LoadedRegistry,
  typeId: string
): LinkType => {
  const found = loaded.linkTypes.get(typeId);
  if (!found) {
    throw new UnknownTypeError({ kind: "link", typeId });
  }
  return found;
};

export const lookupActionType = (
  loaded: LoadedRegistry,
  typeId: string
): ActionType => {
  const found = loaded.actionTypes.get(typeId);
  if (!found) {
    throw new UnknownTypeError({ kind: "action", typeId });
  }
  return found;
};

/** Accept a known Action Type stub without executing Engine (W1 proof). */
export const acceptActionStub = (
  loaded: LoadedRegistry,
  typeId: string
): ActionType => lookupActionType(loaded, typeId);

export { DuplicateTypeError } from "./duplicate-error.js";
export { UnknownTypeError } from "./errors.js";
