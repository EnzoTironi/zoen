import { describe, expect, it } from "@effect/vitest";
import { Effect, Result, Schema } from "effect";

import { validateBasisSnapshot } from "../../src/commit/guards.js";
import {
  CurrentInternalBasis,
  DomainCut,
  LegacyReadSet,
  SubjectIdentityGraph,
  InternalBasis,
  ReadSet,
} from "../../src/ports/worlds/basis.js";
import { PrincipalId } from "../../src/ports/worlds/context.js";
import { structuredDigest } from "../../src/values/canonical.js";

// Synthetic inputs exercise schemas; they are not the real BC-01 migration baseline.
const id = "c4b14bfd-2f39-4fd9-967e-13aebf0f4e14";
const legacyReadSet = {
  clockSample: { observedAt: "2026-09-05T12:00:00.000Z", uncertaintyMillis: 5 },
  identities: [],
  membershipRevision: "1",
  predicates: [],
  sources: [],
  temporalGuards: [],
};
const legacy = {
  cut: {
    cases: "0",
    claims: "1",
    evidence: "1",
    membership: "1",
    sources: "1",
  },
  head: {
    cellEpoch: "1",
    generationId: id,
    releaseDigest: "0".repeat(64),
    securityRevision: "1",
  },
  readSet: legacyReadSet,
  readSetDigest: "1".repeat(64),
  worldRef: { realm: "live", worldId: id },
};
const currentReadSet = {
  ...legacyReadSet,
  schemaVersion: "authority.read-set.v2",
};
const current = {
  ...legacy,
  cut: { ...legacy.cut, identity: "0" },
  readSet: currentReadSet,
  schemaVersion: "authority.basis.v2",
};

describe("EX25 retained and current basis schemas", () => {
  it("retains legacy and accepts explicitly versioned current bases without promotion", () => {
    expect(Schema.decodeUnknownSync(InternalBasis)(legacy)).toStrictEqual(
      legacy
    );
    expect(Schema.decodeUnknownSync(InternalBasis)(current)).toStrictEqual(
      current
    );
  });

  it("requires the actual identity domain for a current cut", () => {
    expect(Schema.decodeSync(DomainCut)(current.cut)).toStrictEqual(
      current.cut
    );
    expect(
      Result.isFailure(Schema.decodeUnknownResult(DomainCut)(legacy.cut))
    ).toBeTruthy();
  });

  it("does not accept the unversioned read set as a new write", () => {
    expect(
      Result.isFailure(Schema.decodeUnknownResult(ReadSet)(legacyReadSet))
    ).toBeTruthy();
    expect(Schema.decodeUnknownSync(ReadSet)(currentReadSet)).toStrictEqual(
      currentReadSet
    );
  });

  it("rejects mixed versions and unknown fields instead of dropping them", () => {
    for (const malformed of [
      { ...current, readSet: legacyReadSet },
      { ...current, cut: legacy.cut },
      { ...legacy, readSet: currentReadSet },
      { ...legacy, cut: current.cut },
      { ...current, privileged: true },
    ]) {
      expect(
        Result.isFailure(Schema.decodeUnknownResult(InternalBasis)(malformed))
      ).toBeTruthy();
    }
  });
});

const graph = {
  _tag: "SubjectIdentityGraph",
  anchors: ["A", "C"],
  closureAnchors: ["A", "B", "C"],
  interval: { _tag: "DateInterval", from: "2026-09-01", to: "2026-10-01" },
  principalRef: id,
  purpose: "personal-records",
  revision: "0",
};
const snapshot = (basis: CurrentInternalBasis) => ({
  cut: basis.cut,
  head: basis.head,
  membershipRevision: basis.readSet.membershipRevision,
  principalId: Schema.decodeSync(PrincipalId)(id),
  purpose: "personal-records" as const,
  worldRef: basis.worldRef,
});
const withDigest = Effect.fn("test.currentBasis")(function* withDigest(
  identities: readonly unknown[]
) {
  const readSet = yield* Schema.decodeUnknownEffect(ReadSet)({
    ...currentReadSet,
    identities,
  });
  return yield* Schema.decodeUnknownEffect(CurrentInternalBasis)({
    ...current,
    readSet,
    readSetDigest: yield* structuredDigest("read-set", readSet),
  });
});

describe("EX25 identity scope and retained digests", () => {
  it("requires canonical unique seeds contained in the complete closure", () => {
    expect(Schema.decodeUnknownSync(SubjectIdentityGraph)(graph)).toStrictEqual(
      graph
    );
    for (const mutation of [
      { anchors: [] },
      { anchors: ["A", "A"] },
      { anchors: ["C", "A"] },
      { anchors: ["D"] },
      { closureAnchors: ["A", "C", "B"] },
      { closureAnchors: ["A", "B", "C", "C"] },
      { closureAnchors: [] },
      {
        closureAnchors: Array.from(
          { length: 33 },
          (_, index) => `A${index.toString().padStart(2, "0")}`
        ),
      },
      { worldRef: legacy.worldRef },
    ]) {
      expect(
        Result.isFailure(
          Schema.decodeUnknownResult(SubjectIdentityGraph)({
            ...graph,
            ...mutation,
          })
        )
      ).toBeTruthy();
    }
  });

  it("preserves the reserved legacy dependency without accepting it as current", () => {
    const reserved = { namespace: "legacy", revision: "0", subjectKey: "A" };
    const old = { ...legacyReadSet, identities: [reserved] };
    expect(Schema.decodeSync(LegacyReadSet)(old)).toStrictEqual(old);
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(ReadSet)({
          ...currentReadSet,
          identities: [reserved],
        })
      )
    ).toBeTruthy();
  });

  it.effect(
    "keeps the legacy read-set digest and binds the new discriminator",
    () =>
      Effect.gen(function* preserveLegacyDigest() {
        const old = yield* structuredDigest(
          "read-set",
          yield* Schema.decodeEffect(LegacyReadSet)(legacyReadSet)
        );
        // Independently calculated from the old canonical JSON and unchanged domain prefix.
        expect(old).toBe(
          "71aecc91b871442532bb734fecc20cb21db7d6299d2f6ab642569955d66be7b0"
        );
        const fresh = yield* structuredDigest(
          "read-set",
          yield* Schema.decodeUnknownEffect(ReadSet)(currentReadSet)
        );
        expect(fresh).not.toBe(old);
        expect(
          yield* Schema.decodeUnknownEffect(InternalBasis)({
            ...legacy,
            readSetDigest: old,
          })
        ).toStrictEqual({ ...legacy, readSetDigest: old });
      })
  );

  it.effect(
    "rejects a new act on valid retained legacy before any source lookup",
    () =>
      Effect.gen(function* rejectLegacyAct() {
        const fresh = yield* withDigest([]);
        const readSetDigest = yield* structuredDigest(
          "read-set",
          yield* Schema.decodeEffect(LegacyReadSet)(legacyReadSet)
        );
        const result = yield* validateBasisSnapshot(
          yield* Schema.decodeUnknownEffect(InternalBasis)({
            ...legacy,
            readSetDigest,
          }),
          snapshot(fresh)
        ).pipe(Effect.result);
        expect(Result.isFailure(result)).toBeTruthy();
        if (Result.isFailure(result)) {
          expect(result.failure._tag).toBe("Stale");
        }
      })
  );

  it.effect(
    "validates a complete current literal basis and fences identity absence",
    () =>
      Effect.gen(function* fenceIdentityAbsence() {
        const fresh = yield* withDigest([]);
        expect(
          yield* validateBasisSnapshot(fresh, snapshot(fresh))
        ).toStrictEqual(fresh);
        const changed = {
          ...snapshot(fresh),
          cut: yield* Schema.decodeEffect(DomainCut)({
            ...fresh.cut,
            identity: "1",
          }),
        };
        const result = yield* validateBasisSnapshot(fresh, changed).pipe(
          Effect.result
        );
        expect(Result.isFailure(result)).toBeTruthy();
        if (Result.isFailure(result)) {
          expect(result.failure._tag).toBe("Stale");
        }
      })
  );

  it.effect(
    "binds graph dependencies to the verified principal and current identity revision",
    () =>
      Effect.gen(function* bindIdentityScope() {
        const fresh = yield* withDigest([graph]);
        expect(
          yield* validateBasisSnapshot(fresh, snapshot(fresh))
        ).toStrictEqual(fresh);
        for (const dependency of [
          { ...graph, principalRef: "6a7464c2-b599-4ff4-a528-4c1b9b99971a" },
          { ...graph, revision: "1" },
        ]) {
          const wrong = yield* withDigest([dependency]);
          const result = yield* validateBasisSnapshot(
            wrong,
            snapshot(wrong)
          ).pipe(Effect.result);
          expect(Result.isFailure(result)).toBeTruthy();
          if (Result.isFailure(result)) {
            expect(result.failure._tag).toBe("Stale");
          }
        }
      })
  );
});

describe("EX25 legacy integrity before version staleness", () => {
  it.effect("fails closed on a well-formed but incorrect legacy digest", () =>
    Effect.gen(function* rejectCorruptLegacy() {
      const fresh = yield* withDigest([]);
      const corrupted =
        yield* Schema.decodeUnknownEffect(InternalBasis)(legacy);
      const result = yield* validateBasisSnapshot(
        corrupted,
        snapshot(fresh)
      ).pipe(Effect.result);
      expect(Result.isFailure(result)).toBeTruthy();
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("Unavailable");
      }
    })
  );

  it.effect("preserves current-basis digest mismatch as Stale", () =>
    Effect.gen(function* preserveCurrentMismatch() {
      const fresh = yield* withDigest([]);
      const corrupted = yield* Schema.decodeEffect(CurrentInternalBasis)({
        ...fresh,
        readSetDigest: "1".repeat(64),
      });
      const result = yield* validateBasisSnapshot(
        corrupted,
        snapshot(fresh)
      ).pipe(Effect.result);
      expect(Result.isFailure(result)).toBeTruthy();
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("Stale");
      }
    })
  );
});
