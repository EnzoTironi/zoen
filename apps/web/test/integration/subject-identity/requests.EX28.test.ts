import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { WorldRef } from "@zoen/contracts/d01/values";
import { Effect, Schema } from "effect";

import type { IdentityInspectedFrame } from "../../../src/features/subject-identity/model.ts";
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
    expect(inspect.input.anchors).toEqual(["A", "B"]);

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
      const frame = {
        assertionSegments: [],
        audience: "private-author",
        cells: [
          {
            activeAssertionRefs: [],
            cellRef: "a".repeat(64),
            components: [{ members: ["A", "B"], representative: "A" }],
            comparisons: [],
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
      } as unknown as IdentityInspectedFrame;
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
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );

      const partitions = partitionAnchorAway(frame, "A");
      expect(partitions[0]?.blocks).toEqual([["A"], ["B"]]);
    })
);
