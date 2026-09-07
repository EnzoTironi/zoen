import { Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  InternalBasis,
  TemporalGuard,
} from "../../../src/ports/worlds/basis.js";
import {
  DataPolicySchema,
  VerifiedPresence,
} from "../../../src/ports/worlds/context.js";
import { ObjectLocation } from "../../../src/ports/worlds/storage.js";

const id = "c4b14bfd-2f39-4fd9-967e-13aebf0f4e14";
const world = { realm: "live", worldId: id };
const privateBasis = {
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
  readSet: {
    clockSample: {
      observedAt: "2026-09-05T12:00:00.000Z",
      uncertaintyMillis: 5,
    },
    identities: [],
    membershipRevision: "1",
    predicates: [
      {
        domain: "claims",
        predicate: "obligation.amount",
        subjectKey: "order-1",
        version: "1",
      },
    ],
    sources: [],
    temporalGuards: [{ notAfter: "2026-09-05T12:00:30.000Z", notBefore: null }],
  },
  readSetDigest: "1".repeat(64),
  worldRef: world,
};

describe("EX02 private contracts", () => {
  it("requires dependencies beyond row versions and a digest", () => {
    expect(Schema.decodeUnknownSync(InternalBasis)(privateBasis)).toStrictEqual(
      privateBasis
    );
    const incomplete = {
      ...privateBasis,
      readSet: { readSetDigest: "1".repeat(64), rowVersions: [] },
    };
    expect(
      Result.isFailure(Schema.decodeUnknownResult(InternalBasis)(incomplete))
    ).toBeTruthy();
  });

  it("bounds a temporal guard without treating an observation as a version", () => {
    expect(
      Schema.decodeSync(TemporalGuard)({
        notAfter: null,
        notBefore: null,
      })
    ).toStrictEqual({ notAfter: null, notBefore: null });
    expect(
      Result.isFailure(
        Schema.decodeResult(TemporalGuard)({
          notAfter: "2026-09-05T12:00:00.000Z",
          notBefore: "2026-09-05T12:00:30.000Z",
        })
      )
    ).toBeTruthy();
  });

  it("does not encode a presence that lasts before it was authenticated", () => {
    const presence = {
      authenticatedAt: "2026-09-05T12:00:00.000Z",
      expiresAt: "2026-09-05T13:00:00.000Z",
      principalId: id,
      realm: "live",
      sessionId: "opaque-provider-session",
    };
    expect(Schema.decodeUnknownSync(VerifiedPresence)(presence)).toStrictEqual(
      presence
    );
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(VerifiedPresence)({
          ...presence,
          expiresAt: presence.authenticatedAt,
        })
      )
    ).toBeTruthy();
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(VerifiedPresence)({
          ...presence,
          grants: ["admin"],
        })
      )
    ).toBeTruthy();
  });

  it("cannot silently enable evaluation, erasure or legal holds in the initial profile", () => {
    const policy = {
      dataScope: "admitted-non-sensitive",
      enabledRealm: "live",
      erasure: false,
      legalHold: false,
      licensedExpiry: false,
      profileId: "worlds-local-retained-v1",
      restoreAfterErasure: false,
      retention: "while-pinned",
    };
    expect(Schema.decodeUnknownSync(DataPolicySchema)(policy)).toStrictEqual(
      policy
    );
    for (const amendment of [
      { enabledRealm: "evaluation" },
      { erasure: true },
      { legalHold: true },
    ]) {
      expect(
        Result.isFailure(
          Schema.decodeUnknownResult(DataPolicySchema)({
            ...policy,
            ...amendment,
          })
        )
      ).toBeTruthy();
    }
  });

  it("requires scoped complete storage metadata, never an ETag as digest", () => {
    const location = {
      byteLength: 10,
      captureId: id,
      digest: "0".repeat(64),
      key: `captures/${id}`,
      versionId: null,
      worldRef: world,
    };
    expect(Schema.decodeUnknownSync(ObjectLocation)(location)).toStrictEqual(
      location
    );
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(ObjectLocation)({
          ...location,
          digest: "etag-1",
        })
      )
    ).toBeTruthy();
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(ObjectLocation)({
          ...location,
          byteLength: 262_145,
        })
      )
    ).toBeTruthy();
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(ObjectLocation)({
          ...location,
          accessKey: "credential",
        })
      )
    ).toBeTruthy();
  });
});
