import { describe, expect, it } from "vitest";

import {
  defaultOmsRegistry,
  defaultOmsRegistryDocument,
} from "../src/packs/default-registry.js";
import { worldsSemanticOperations } from "../src/packs/worlds.js";
import {
  DuplicateTypeError,
  InvalidReferenceError,
  PackIdMismatchError,
  UnknownTypeError,
  acceptActionStub,
  loadRegistry,
  lookupActionType,
  lookupLinkType,
  lookupObjectType,
} from "../src/registry.js";

const emptyEditIntent = {
  creates: [] as string[],
  deletes: [] as string[],
  linkCreates: [] as string[],
  updates: [] as string[],
};

const baseObject = {
  description: "World",
  glossaryTerm: "World",
  id: "worlds.World",
  packId: "worlds",
  properties: [
    {
      description: "World id",
      kind: "uuid",
      name: "worldId",
      nullable: false,
      optional: false,
      refTypeId: null,
    },
  ],
  version: "0.1.0",
};

const baseLink = {
  cardinalityFrom: "one",
  cardinalityTo: "zero-or-more",
  description: "World has evidence",
  fromTypeId: "worlds.World",
  glossaryTerm: "WorldHasEvidence",
  id: "worlds.WorldHasEvidence",
  packId: "worlds",
  toTypeId: "worlds.Evidence",
  version: "0.1.0",
};

const evidenceObject = {
  description: "Evidence",
  glossaryTerm: "Evidence",
  id: "worlds.Evidence",
  packId: "worlds",
  properties: [],
  version: "0.1.0",
};

const baseAction = {
  description: "Create a personal World",
  editIntent: { ...emptyEditIntent, creates: ["worlds.World"] },
  glossaryTerm: "CreatePersonalWorld",
  id: "worlds.CreatePersonalWorld",
  mode: "mutation",
  packId: "worlds",
  parameters: [
    {
      description: "Declared purpose",
      kind: "string",
      name: "purpose",
      nullable: false,
      optional: false,
      refTypeId: null,
    },
  ],
  runtimeBinding: "semantic-executor",
  semanticOperation: "CreatePersonalWorld",
  submissionCriteria: {
    notes: "Authenticated principal",
    requireAuthenticated: true,
    requireOwner: false,
    requireWorldScope: false,
  },
  version: "0.1.0",
};

const basePack = {
  actionTypes: [baseAction],
  description: "Worlds pack fixture",
  id: "worlds",
  linkTypes: [baseLink],
  objectTypes: [baseObject, evidenceObject],
  version: "0.1.0",
};

const baseRegistry = {
  packs: [basePack],
  schemaVersion: "oms.v1",
  version: "0.1.0",
};

const ownerOnlyMutations = [
  "ImportEvidence",
  "ProposeCorrection",
  "AnswerQuestion",
  "UndoCorrection",
  "GrantWorldReadAccess",
  "RevokeWorldReadAccess",
  "RequestWorldErasure",
  "PurgeWorldContent",
] as const;

const requiredNullableParams = [
  ["worlds.Inspect", "atFrame"],
  ["worlds.InspectWorldAccess", "principalRef"],
  ["worlds.GrantWorldReadAccess", "expectedRevision"],
  ["worlds.RequestWorldErasure", "expectedErasureRevision"],
  ["worlds.InspectWorldErasure", "operationId"],
] as const;

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

  it("rejects duplicate pack ids", () => {
    expect(() =>
      loadRegistry({
        ...baseRegistry,
        packs: [basePack, { ...basePack }],
      })
    ).toThrow(DuplicateTypeError);
  });

  it("rejects duplicate object type ids", () => {
    expect(() =>
      loadRegistry({
        ...baseRegistry,
        packs: [
          {
            ...basePack,
            objectTypes: [baseObject, evidenceObject, { ...baseObject }],
          },
        ],
      })
    ).toThrow(DuplicateTypeError);
  });

  it("rejects unknown link endpoints", () => {
    expect(() =>
      loadRegistry({
        ...baseRegistry,
        packs: [
          {
            ...basePack,
            linkTypes: [{ ...baseLink, toTypeId: "worlds.MissingObject" }],
          },
        ],
      })
    ).toThrow(UnknownTypeError);
  });

  it("rejects unknown edit-intent object ids", () => {
    expect(() =>
      loadRegistry({
        ...baseRegistry,
        packs: [
          {
            ...basePack,
            actionTypes: [
              {
                ...baseAction,
                editIntent: {
                  ...emptyEditIntent,
                  creates: ["worlds.MissingObject"],
                },
              },
            ],
          },
        ],
      })
    ).toThrow(UnknownTypeError);
  });

  it("rejects packId mismatches on typed cards", () => {
    expect(() =>
      loadRegistry({
        ...baseRegistry,
        packs: [
          {
            ...basePack,
            objectTypes: [{ ...baseObject, packId: "other" }, evidenceObject],
          },
        ],
      })
    ).toThrow(PackIdMismatchError);
  });

  it("rejects ref fields without a registered target", () => {
    expect(() =>
      loadRegistry({
        ...baseRegistry,
        packs: [
          {
            ...basePack,
            actionTypes: [
              {
                ...baseAction,
                parameters: [
                  {
                    description: "Target World",
                    kind: "ref",
                    name: "worldRef",
                    nullable: false,
                    optional: false,
                    refTypeId: "worlds.MissingObject",
                  },
                ],
              },
            ],
          },
        ],
      })
    ).toThrow(InvalidReferenceError);
  });

  it("rejects non-ref fields that declare a refTypeId", () => {
    expect(() =>
      loadRegistry({
        ...baseRegistry,
        packs: [
          {
            ...basePack,
            actionTypes: [
              {
                ...baseAction,
                parameters: [
                  {
                    description: "Evidence document body",
                    kind: "string",
                    name: "document",
                    nullable: false,
                    optional: false,
                    refTypeId: "worlds.World",
                  },
                ],
              },
            ],
          },
        ],
      })
    ).toThrow(InvalidReferenceError);
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

  it("declares purpose on every Worlds Action Type", () => {
    for (const action of defaultOmsRegistry.actionTypes.values()) {
      const purpose = action.parameters.find((item) => item.name === "purpose");
      expect(purpose?.optional).toBeFalsy();
      expect(purpose?.nullable).toBeFalsy();
      expect(purpose?.kind).toBe("string");
    }
  });

  it("marks owner-only tip mutations with requireOwner", () => {
    for (const operation of ownerOnlyMutations) {
      const action = [...defaultOmsRegistry.actionTypes.values()].find(
        (item) => item.semanticOperation === operation
      );
      expect(action?.submissionCriteria.requireOwner).toBeTruthy();
    }
  });

  it("marks NullOr SemanticRequest fields as required+nullable", () => {
    for (const [actionId, paramName] of requiredNullableParams) {
      const action = lookupActionType(defaultOmsRegistry, actionId);
      const param = action.parameters.find((item) => item.name === paramName);
      expect(param?.optional).toBeFalsy();
      expect(param?.nullable).toBeTruthy();
    }
  });
});
