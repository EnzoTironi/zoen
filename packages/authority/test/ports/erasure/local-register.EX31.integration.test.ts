import { randomBytes, randomUUID } from "node:crypto";

import { PgClient } from "@effect/sql-pg";
import { expect, it } from "@effect/vitest";
import { Unavailable } from "@zoen/contracts/d01/errors";
import { OperationId, WorldId } from "@zoen/contracts/d01/values";
import { Config, Effect, Layer, Redacted, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { PrincipalId } from "../../../src/ports/d01/context.js";
import {
  ErasureAttemptRegister,
  blocksWorldActivation,
} from "../../../src/ports/erasure/attempt-register.js";
import type {
  ErasureAttemptIdentity,
  ErasureAttemptIntention,
} from "../../../src/ports/erasure/attempt-register.js";
import {
  applyErasureAttemptSchema,
  localErasureAttemptRegisterLayer,
} from "../../../src/ports/erasure/local-pg.js";

const profile = (url: Redacted.Redacted, name: string) => ({
  applicationName: `zoen-ex31-${name}`,
  maxConnections: 4,
  url,
});

const intention = (
  policyVersion = "d03-local-erasable-v1"
): ErasureAttemptIntention => ({
  confirmEntireWorld: true,
  expectedErasureRevision: null,
  policyVersion,
});

const identityOf = (
  operationId: string,
  worldId = randomUUID()
): ErasureAttemptIdentity => ({
  deploymentEpoch: "ex31-local-epoch",
  operationId: Schema.decodeSync(OperationId)(operationId),
  principalId: Schema.decodeSync(PrincipalId)(randomUUID()),
  worldRef: {
    realm: "live",
    worldId: Schema.decodeSync(WorldId)(worldId),
  },
});

/** Disposable DB + role; register schema only (separate from authority rollback). */
const withRegisterDatabase = <A, E>(
  run: Effect.Effect<A, E, ErasureAttemptRegister | SqlClient.SqlClient>
) =>
  Effect.gen(function* configure() {
    const adminUrl = yield* Config.redacted("ZOEN_TEST_DATABASE_URL");
    const suffix = randomBytes(12).toString("hex");
    const databaseName = `ex31_erasure_${suffix}`;
    const roleName = `ex31_erasure_${suffix}`;
    const password = randomBytes(32).toString("hex");
    const roleUrl = (() => {
      const url = new URL(Redacted.value(adminUrl));
      url.pathname = `/${databaseName}`;
      url.username = roleName;
      url.password = password;
      return Redacted.make(url.href);
    })();
    const adminLayer = PgClient.layer(profile(adminUrl, "admin"));
    const registerPg = PgClient.layer(profile(roleUrl, "register"));
    return yield* Effect.scoped(
      Effect.gen(function* ownDatabase() {
        const admin = yield* SqlClient.SqlClient;
        yield* Effect.acquireRelease(
          admin
            .unsafe(
              `CREATE ROLE "${roleName}" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS NOREPLICATION PASSWORD '${password}'`
            )
            .pipe(Effect.orDie),
          () => admin`DROP ROLE ${admin(roleName)}`.pipe(Effect.orDie)
        );
        yield* Effect.acquireRelease(
          admin`CREATE DATABASE ${admin(databaseName)} OWNER ${admin(roleName)}`,
          () =>
            admin`DROP DATABASE ${admin(databaseName)} WITH (FORCE)`.pipe(
              Effect.orDie
            )
        );
        yield* applyErasureAttemptSchema().pipe(Effect.provide(registerPg));
        yield* Effect.gen(function* probe() {
          const sql = yield* SqlClient.SqlClient;
          yield* sql.withTransaction(
            sql.unsafe(`
              CREATE SCHEMA IF NOT EXISTS authority;
              CREATE TABLE IF NOT EXISTS authority.worlds (
                world_id uuid PRIMARY KEY,
                realm text NOT NULL,
                phase text NOT NULL DEFAULT 'Active'
              );
            `)
          );
        }).pipe(Effect.provide(registerPg));
        return yield* run.pipe(
          Effect.provide(
            localErasureAttemptRegisterLayer.pipe(
              Layer.provideMerge(registerPg)
            )
          )
        );
      })
    ).pipe(Effect.provide(adminLayer));
  });

it.live(
  "EX31 local register: durable register, idempotent replay, payload conflict, no World mutation",
  () =>
    withRegisterDatabase(
      Effect.gen(function* proof() {
        const op = randomUUID();
        const worldId = randomUUID();
        const id = identityOf(op, worldId);
        const firstIntention = intention();
        const port = yield* ErasureAttemptRegister;
        const sql = yield* SqlClient.SqlClient;

        const first = yield* port.register(id, firstIntention);
        expect(first).toStrictEqual({ state: "Registered" });
        expect(blocksWorldActivation(first.state)).toBeTruthy();

        const replay = yield* port.register(id, firstIntention);
        expect(replay).toStrictEqual({ state: "Registered" });

        const conflictExit = yield* Effect.exit(
          port.register(id, intention("d03-local-erasable-v1-other"))
        );
        expect(conflictExit._tag).toBe("Failure");

        const inspected = yield* port.inspect(id);
        expect(inspected).toStrictEqual({ state: "Registered" });

        const worldsBefore = yield* sql`
          SELECT count(*)::text AS count FROM authority.worlds
        `;
        expect(worldsBefore).toStrictEqual([{ count: "0" }]);

        const rolled = yield* Effect.exit(
          sql.withTransaction(
            Effect.gen(function* authorityTx() {
              yield* sql`
                INSERT INTO authority.worlds (world_id, realm, phase)
                VALUES (${worldId}::uuid, ${"live"}, ${"Active"})
              `;
              return yield* new Unavailable({ code: "UNAVAILABLE" });
            })
          )
        );
        expect(rolled._tag).toBe("Failure");

        const worldsAfter = yield* sql`
          SELECT count(*)::text AS count FROM authority.worlds
        `;
        expect(worldsAfter).toStrictEqual([{ count: "0" }]);

        const stillRegistered = yield* port.inspect(id);
        expect(stillRegistered).toStrictEqual({ state: "Registered" });

        const aborted = yield* port.mirrorLocalOutcome(id, "Aborted");
        expect(aborted).toStrictEqual({ state: "Aborted" });
        const confirmConflict = yield* Effect.exit(
          port.mirrorLocalOutcome(id, "Confirmed")
        );
        expect(confirmConflict._tag).toBe("Failure");
        expect(blocksWorldActivation("Aborted")).toBeFalsy();
      })
    )
);
