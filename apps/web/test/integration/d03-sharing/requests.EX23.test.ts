import { randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import { WorldRef } from "@zoen/contracts/d01/values";
import { Membership, PrincipalRef } from "@zoen/contracts/sharing/operations";
import { Effect, Schema } from "effect";

import {
  confirmAccessRequest,
  inspectAccessRequest,
} from "../../../src/features/sharing/requests.ts";

const world = Schema.decodeSync(WorldRef)({
  realm: "live",
  worldId: randomUUID(),
});
const principal = Schema.decodeSync(PrincipalRef)(randomUUID());

it.effect(
  "EX23 own inspection uses null and exact recipient input rejects email",
  () =>
    Effect.gen(function* inspectExact() {
      const own = yield* inspectAccessRequest(world, null);
      expect(own.input).toStrictEqual({ principalRef: null });
      expect(own.schemaVersion).toBe("d03.sharing.v1");
      expect("operationId" in own).toBeFalsy();
      expect(
        yield* inspectAccessRequest(world, "person@example.test").pipe(
          Effect.flip
        )
      ).toMatchObject({ _tag: "InvalidInput" });
      const recipient = yield* inspectAccessRequest(world, principal);
      expect(recipient.input.principalRef).toBe(principal);
    })
);

it.effect(
  "EX23 confirmation binds absence versus revision and each new intention has a fresh ID",
  () =>
    Effect.gen(function* confirmRevision() {
      const absent = { membership: null, principalRef: principal };
      const first = yield* confirmAccessRequest(world, absent, "grant");
      const second = yield* confirmAccessRequest(world, absent, "grant");
      expect(first.operationId).not.toBe(second.operationId);
      expect(first.input).toStrictEqual({
        expectedRevision: null,
        principalRef: principal,
      });
      expect(first.operation).toBe("GrantWorldReadAccess");
      expect(
        yield* confirmAccessRequest(world, absent, "revoke").pipe(Effect.flip)
      ).toMatchObject({ _tag: "InvalidInput" });
    })
);

it.effect(
  "EX23 regrant and revoke preserve the exact inspected decimal revision",
  () =>
    Effect.gen(function* exactRevision() {
      const membership = yield* Schema.decodeEffect(Membership)({
        principalRef: principal,
        revision: "987654321012345678",
        role: "viewer",
        state: "revoked",
      });
      const regrant = yield* confirmAccessRequest(
        world,
        { membership, principalRef: principal },
        "grant"
      );
      const revoke = yield* confirmAccessRequest(
        world,
        { membership, principalRef: principal },
        "revoke"
      );
      expect(regrant.input.expectedRevision).toBe(membership.revision);
      expect(revoke.input.expectedRevision).toBe(membership.revision);
      expect(revoke.operation).toBe("RevokeWorldReadAccess");
      expect(revoke.worldRef).toStrictEqual(world);
    })
);
