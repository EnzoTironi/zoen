import { expect, it } from "@effect/vitest";
import { Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { hostedAdmissionLayer } from "../../../../apps/server/src/composition.js";
import { withD01Database } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { resolveLocalWorldPolicy } from "../../../../ops/local/world-policy.ts";
import { createPersonalWorld } from "../../../../packages/authority/src/commit/genesis.js";
import {
  HostedAdmissionFlags,
  assertOnlyCoreSurfacesAdmitted,
  d04HostedRetainedAdmissionFlags,
  readinessFor,
  reportsFalseHealthy,
  requireAdmittedCapability,
  requireChannelReadiness,
} from "../../../../packages/authority/src/hosted/admission/flags.js";
import { HostedRetainedDataPolicySchema } from "../../../../packages/authority/src/ports/worlds/context.js";
import {
  hostedConfiguration,
  hostedRetainedPolicy,
  localRetainedConfiguration,
  localRetainedPolicy,
  makeContext,
  makeCreateWorld,
} from "./fixture.js";

/**
 * EX39 independent oracles: local hosted-retained compose (new Worlds) +
 * EX38 admission flags + provision policy helper. Not production Fly.
 */

it.live(
  "EX39 hosted-retained NEW Worlds stamp d04 policy; erasure/restore closed",
  () =>
    withD01Database((database) =>
      Effect.gen(function* hostedStamp() {
        const context = yield* makeContext();
        const request = yield* makeCreateWorld();
        const created = yield* createPersonalWorld(context, request);
        const sql = yield* SqlClient.SqlClient;
        expect(
          yield* sql`
            SELECT data_policy_id FROM authority.worlds
            WHERE world_id = ${created.worldRef.worldId}
          `
        ).toStrictEqual([{ data_policy_id: "d04-hosted-retained-v1" }]);
        expect(hostedRetainedPolicy.erasure).toBeFalsy();
        expect(hostedRetainedPolicy.restoreAfterErasure).toBeFalsy();
        expect(
          Schema.is(HostedRetainedDataPolicySchema)(hostedRetainedPolicy)
        ).toBeTruthy();
        expect(
          resolveLocalWorldPolicy("d04-hosted-retained-v1")?.profileId
        ).toBe("d04-hosted-retained-v1");
      }).pipe(
        Effect.provide(Layer.mergeAll(hostedConfiguration, database.authority))
      )
    )
);

it.live("EX39 default local retained remains distinct (no hosted rebind)", () =>
  withD01Database((database) =>
    Effect.gen(function* retainedDefault() {
      const context = yield* makeContext();
      const request = yield* makeCreateWorld();
      const created = yield* createPersonalWorld(context, request);
      const sql = yield* SqlClient.SqlClient;
      expect(
        yield* sql`
            SELECT data_policy_id FROM authority.worlds
            WHERE world_id = ${created.worldRef.worldId}
          `
      ).toStrictEqual([{ data_policy_id: "worlds-local-retained-v1" }]);
      expect(localRetainedPolicy.profileId).toBe("worlds-local-retained-v1");
      expect(
        resolveLocalWorldPolicy("worlds-local-retained-v1")?.profileId
      ).toBe("worlds-local-retained-v1");
      // Local retained compose must not select the hosted profile id.
      expect(localRetainedPolicy.profileId).not.toBe(
        hostedRetainedPolicy.profileId
      );
    }).pipe(
      Effect.provide(
        Layer.mergeAll(localRetainedConfiguration, database.authority)
      )
    )
  )
);

it.live(
  "EX39 composition admission layer: core ready; channels Blocked; no false healthy",
  () =>
    withD01Database((database) =>
      Effect.gen(function* admissionCompose() {
        const flags = yield* HostedAdmissionFlags;
        expect(flags).toStrictEqual(d04HostedRetainedAdmissionFlags);
        expect(assertOnlyCoreSurfacesAdmitted(flags)).toBeTruthy();
        for (const surface of ["web", "cli", "file"] as const) {
          const readiness = readinessFor(flags, surface);
          expect(readiness).toMatchObject({
            admitted: true,
            status: "ready",
          });
          expect(reportsFalseHealthy(readiness)).toBeFalsy();
          yield* requireAdmittedCapability(surface, flags);
        }
        const denied = yield* requireAdmittedCapability("whatsapp", flags).pipe(
          Effect.flip
        );
        expect(denied).toMatchObject({
          _tag: "Blocked",
          code: "PROFILE_BLOCKED",
        });
        const channel = yield* requireChannelReadiness({
          channelId: "whatsapp",
          flags,
          providerProvisioned: false,
        }).pipe(Effect.flip);
        expect(channel).toMatchObject({
          _tag: "Blocked",
          code: "PROFILE_BLOCKED",
        });
      }).pipe(
        Effect.provide(Layer.mergeAll(hostedAdmissionLayer, database.authority))
      )
    )
);
