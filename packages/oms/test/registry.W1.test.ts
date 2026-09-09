import { describe, expect, it } from "vitest";

import {
  defaultOmsRegistry,
  defaultOmsRegistryDocument,
} from "../src/packs/default-registry.js";
import { worldsSemanticOperations } from "../src/packs/worlds.js";
import {
  UnknownTypeError,
  acceptActionStub,
  loadRegistry,
  lookupActionType,
  lookupLinkType,
  lookupObjectType,
} from "../src/registry.js";

describe("OMS W1 registry", () => {
  it("loads the default registry document", () => {
    const loaded = loadRegistry(defaultOmsRegistryDocument);
    expect(loaded.registry.schemaVersion).toBe("oms.v1");
    expect(loaded.registry.version).toBe("0.1.0");
    expect(loaded.packs.has("worlds")).toBeTruthy();
    expect(loaded.objectTypes.size).toBeGreaterThanOrEqual(1);
    expect(loaded.actionTypes.size).toBeGreaterThanOrEqual(1);
  });

  it("indexes link types from the Worlds pack", () => {
    expect(defaultOmsRegistry.linkTypes.size).toBeGreaterThanOrEqual(1);
    expect(
      lookupLinkType(defaultOmsRegistry, "worlds.WorldHasEvidence").toTypeId
    ).toBe("worlds.Evidence");
  });

  it("looks up Object and Action types by id", () => {
    expect(
      lookupObjectType(defaultOmsRegistry, "worlds.World").glossaryTerm
    ).toBe("World");
    const action = lookupActionType(
      defaultOmsRegistry,
      "worlds.CreatePersonalWorld"
    );
    expect(action.semanticOperation).toBe("CreatePersonalWorld");
    expect(action.runtimeBinding).toBe("semantic-executor");
    expect(action.submissionCriteria.requireAuthenticated).toBeTruthy();
    expect(action.editIntent.creates).toContain("worlds.World");
  });

  it("accepts a known Action Type stub without executing Engine", () => {
    const stub = acceptActionStub(defaultOmsRegistry, "worlds.ImportEvidence");
    expect(stub.id).toBe("worlds.ImportEvidence");
    expect(stub.mode).toBe("mutation");
  });

  it("rejects unknown Action Type ids (fail closed)", () => {
    expect(() =>
      lookupActionType(defaultOmsRegistry, "worlds.NotARealAction")
    ).toThrow(UnknownTypeError);
  });

  it("rejects unknown Object Type ids", () => {
    expect(() =>
      lookupObjectType(defaultOmsRegistry, "enterprise.PurchaseOrder")
    ).toThrow(UnknownTypeError);
  });

  it("rejects invalid registry documents", () => {
    expect(() =>
      loadRegistry({
        packs: [],
        schemaVersion: "oms.v1",
        version: "0.1.0",
      })
    ).toThrow(/Array|minLength|isMinLength|expected/iu);
  });
});

describe("OMS W1 Worlds pack completeness", () => {
  const requiredObjects = [
    "worlds.World",
    "worlds.Evidence",
    "worlds.Source",
    "worlds.Correction",
    "worlds.Membership",
    "worlds.ErasureAttempt",
  ] as const;

  it("registers glossary-mapped Object Types", () => {
    for (const id of requiredObjects) {
      expect(defaultOmsRegistry.objectTypes.has(id)).toBeTruthy();
    }
  });

  it("does not invent enterprise ERP Object Types", () => {
    for (const id of defaultOmsRegistry.objectTypes.keys()) {
      expect(id.startsWith("worlds.")).toBeTruthy();
      expect(id.toLowerCase()).not.toContain("purchase");
      expect(id.toLowerCase()).not.toContain("invoice");
      expect(id.toLowerCase()).not.toContain("erp");
    }
  });

  it("covers tip Worlds core SemanticRequest verbs as Action Types", () => {
    const operations = new Set(
      [...defaultOmsRegistry.actionTypes.values()].map(
        (action) => action.semanticOperation
      )
    );
    for (const op of worldsSemanticOperations) {
      expect(operations.has(op)).toBeTruthy();
    }
  });

  it("includes share, revoke, and erasure Action Types", () => {
    const operations = new Set(
      [...defaultOmsRegistry.actionTypes.values()].map(
        (action) => action.semanticOperation
      )
    );
    expect(operations.has("GrantWorldReadAccess")).toBeTruthy();
    expect(operations.has("RevokeWorldReadAccess")).toBeTruthy();
    expect(operations.has("RequestWorldErasure")).toBeTruthy();
    expect(operations.has("PurgeWorldContent")).toBeTruthy();
    expect(operations.has("ProposeCorrection")).toBeTruthy();
  });

  it("binds all Worlds Action Types to semantic-executor until W2", () => {
    for (const action of defaultOmsRegistry.actionTypes.values()) {
      expect(action.runtimeBinding).toBe("semantic-executor");
      expect(action.packId).toBe("worlds");
    }
  });
});
