import { randomBytes, randomUUID } from "node:crypto";

import { NodeServices } from "@effect/platform-node";
import { DateTime, Effect, Layer, Redacted, Schema } from "effect";

import { withD01Database } from "../../../../apps/server/test/adapters/postgres/d01/database.js";
import { makeTestIdentityLayer } from "../../../../apps/server/test/identity/d01/database.js";
import { applySharingMigrations } from "../../../../ops/migrations/run.js";
import {
  Presence,
  VerifiedRequestContext,
} from "../../../../packages/authority/src/ports/d01/context.js";
import { CreatePersonalWorld } from "../../../../packages/contracts/src/d01/operations.js";

type Database = Parameters<Parameters<typeof withD01Database>[0]>[0];
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
  withD01Database(
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
      applySharingMigrations(database.names).pipe(
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
      schemaVersion: "d01.v1",
    })
  )
);
