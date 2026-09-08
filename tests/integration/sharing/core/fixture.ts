import { randomBytes, randomUUID } from "node:crypto";

import { NodeServices } from "@effect/platform-node";
import { DateTime, Effect, Layer, Redacted, Schema } from "effect";

import { withWorldsDatabase } from "../../../../apps/server/test/adapters/postgres/worlds/database.js";
import { makeTestIdentityLayer } from "../../../../apps/server/test/identity/database.js";
import { applyIdentityBasisMigrations } from "../../../../ops/migrations/run.js";
import { CreatePersonalWorld } from "../../../../packages/contracts/src/worlds/operations.js";
import {
  Presence,
  VerifiedRequestContext,
} from "../../../../packages/ontology/src/ports/worlds/context.js";

type Database = Parameters<Parameters<typeof withWorldsDatabase>[0]>[0];
export const withSharingDatabase = <A, E, R>(
  run: (fixture: {
    readonly database: Database;
    readonly config: {
      readonly baseUrl: string;
      readonly databaseUrl: Redacted.Redacted;
      readonly secret: Redacted.Redacted;
      readonly sessionSeconds: number;
    };
    readonly runtime: ReturnType<typeof makeTestIdentityLayer>;
  }) => Effect.Effect<A, E, R>
) =>
  withWorldsDatabase(
    (database) => {
      const config = {
        baseUrl: "http://localhost:3000",
        databaseUrl: database.urls.identity,
        secret: Redacted.make(randomBytes(32).toString("hex")),
        sessionSeconds: 3600,
      };
      return run({
        config,
        database,
        runtime: makeTestIdentityLayer(config, database),
      });
    },
    undefined,
    (database) =>
      applyIdentityBasisMigrations(database.names).pipe(
        Effect.provide(Layer.mergeAll(database.migration, NodeServices.layer))
      )
  );

export const verifiedContext = Effect.fn("SH.verifiedContext")(
  function* verifiedContext(credential: Redacted.Redacted) {
    const presence = yield* Presence;
    const now = yield* DateTime.now;
    return yield* Schema.decodeEffect(VerifiedRequestContext)({
      deadline: DateTime.formatIso(DateTime.add(now, { seconds: 30 })),
      presence: yield* presence.verify(credential),
      purpose: "personal-records",
    });
  }
);
export const genesisRequest = Effect.sync(randomUUID).pipe(
  Effect.flatMap((operationId) =>
    Schema.decodeEffect(CreatePersonalWorld)({
      input: {},
      operation: "CreatePersonalWorld",
      operationId,
      purpose: "personal-records",
      schemaVersion: "worlds.v1",
    })
  )
);
