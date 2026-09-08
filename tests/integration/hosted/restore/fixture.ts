import { randomUUID } from "node:crypto";

import { DateTime, Effect, Layer, Schema } from "effect";

import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "../../../../packages/authority/src/commit/configuration.js";
import {
  DataPolicy,
  HostedRetainedDataPolicySchema,
  RetainedDataPolicySchema,
  VerifiedRequestContext,
} from "../../../../packages/authority/src/ports/worlds/context.js";
import { digestBytes } from "../../../../packages/authority/src/values/canonical.js";
import { CreatePersonalWorld } from "../../../../packages/contracts/src/worlds/operations.js";

export const installation = Schema.decodeSync(AuthorityInstallationSchema)({
  cellEpoch: "1",
  cellId: randomUUID(),
  generationId: randomUUID(),
  releaseDigest: digestBytes(
    new TextEncoder().encode("EX37 hosted retained disposable restore fixture")
  ),
});

/** Enabled hosted retained scope (freeze H01–H02 / EX36). */
export const hostedRetainedPolicy = Schema.decodeSync(
  HostedRetainedDataPolicySchema
)({
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: false,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-hosted-retained-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
});

/** Local default retained — must not be rebound by hosted restore proofs. */
export const localRetainedPolicy = Schema.decodeSync(RetainedDataPolicySchema)({
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: false,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-local-retained-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
});

export const hostedConfiguration = Layer.merge(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, hostedRetainedPolicy)
);

export const localRetainedConfiguration = Layer.merge(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, localRetainedPolicy)
);

export const makeContext = Effect.fn("EX37.makeContext")(function* makeContext(
  principalId: string = randomUUID()
) {
  const now = yield* DateTime.now;
  return yield* Schema.decodeEffect(VerifiedRequestContext)({
    deadline: DateTime.formatIso(DateTime.add(now, { seconds: 30 })),
    presence: {
      authenticatedAt: DateTime.formatIso(
        DateTime.subtract(now, { seconds: 1 })
      ),
      expiresAt: DateTime.formatIso(DateTime.add(now, { minutes: 1 })),
      principalId,
      realm: "live",
      sessionId: randomUUID(),
    },
    purpose: "personal-records",
  });
});

export const makeCreateWorld = Effect.fn("EX37.makeCreateWorld")(
  function* makeCreateWorld() {
    return yield* Schema.decodeEffect(CreatePersonalWorld)({
      input: {},
      operation: "CreatePersonalWorld",
      operationId: randomUUID(),
      purpose: "personal-records",
      schemaVersion: "worlds.v1",
    });
  }
);
