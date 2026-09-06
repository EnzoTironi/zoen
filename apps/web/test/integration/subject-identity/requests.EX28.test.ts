import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { WorldRef } from "@zoen/contracts/d01/values";
import { IdentityFrame } from "@zoen/contracts/subject-identity/frame";
import { Effect, Schema } from "effect";

import {
  inspectIdentityRecoveryRequest,
  inspectIdentityRequest,
  partitionAnchorAway,
  proposeSameAsRequest,
  resolveIdentityRequest,
} from "../../../src/features/subject-identity/requests.ts";

const world = Schema.decodeSync(WorldRef)({
  realm: "live",
  worldId: randomUUID(),
});

const sampleFrame = () =>
  Schema.decodeUnknownSync(IdentityFrame)({
    assertionSegments: [],
    audience: "private-author",
    cells: [
      {
        activeAssertionRefs: [],
        cellRef: "a".repeat(64),
        comparisons: [],
        components: [{ members: ["A", "B"], representative: "A" }],
        coveredClaimRefs: [],
        distinctions: [],
        interval: {
          _tag: "DateInterval",
          from: "2026-09-01",
          to: "2026-10-01",
        },
      },
    ],
    claims: [],
    closureAnchors: ["A", "B"],
    frameRef: randomUUID(),
    interval: {
      _tag: "DateInterval",
      from: "2026-09-01",
      to: "2026-10-01",
    },
    kind: "subject-identity",
    purpose: "personal-records",
    requestedAnchors: ["A", "B"],
    schemaVersion: "subject-identity.v1",
    worldRef: world,
  });

it.effect("EX28 inspect requests omit operationId and bind schemaVersion", () =>
  Effect.gen(function* inspectShape() {
    const inspect = yield* inspectIdentityRequest(
      world,
      ["A", "B"],
      "2026-09-01",
      "2026-10-01",
      null
    );
    expect(inspect.operation).toBe("InspectSubjectIdentity");
    expect(inspect.schemaVersion).toBe("subject-identity.v1");
    expect("operationId" in inspect).toBeFalsy();
    expect(inspect.input.anchors).toStrictEqual(["A", "B"]);
  })
);

it.effect("EX28 recovery inspect binds targetDecisionRef", () =>
  Effect.gen(function* recoveryShape() {
    const recovery = yield* inspectIdentityRecoveryRequest(
      world,
      "A",
      "2026-09-01",
      "2026-10-01",
      null
    );
    expect(recovery.operation).toBe("InspectIdentityRecovery");
    expect(recovery.input.targetDecisionRef).toBeNull();
  })
);

it.effect(
  "EX28 propose/resolve mint fresh operationIds and retain digest on resolve",
  () =>
    Effect.gen(function* mutationIds() {
      const frame = sampleFrame();
      const first = yield* proposeSameAsRequest(world, frame, "A", "B");
      const second = yield* proposeSameAsRequest(world, frame, "A", "B");
      expect(first.operationId).not.toBe(second.operationId);
      expect(first.input.frame.frameRef).toBe(frame.frameRef);

      const digest = "b".repeat(64);
      const questionRef = randomUUID();
      const resolve = yield* resolveIdentityRequest(
        world,
        questionRef,
        digest,
        "same-as"
      );
      expect(resolve.input.consequenceDigest).toBe(digest);
      expect(resolve.input.questionRef).toBe(questionRef);
      expect(resolve.operationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
      );
    })
);

it.effect("EX28 partition helper separates the requested anchor", () =>
  Effect.gen(function* partitionShape() {
    yield* Effect.void;
    const frame = sampleFrame();
    const partitions = partitionAnchorAway(frame, "A");
    expect(partitions[0]?.blocks).toStrictEqual([["A"], ["B"]]);
  })
);
