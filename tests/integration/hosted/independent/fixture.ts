import { randomUUID } from "node:crypto";

import { DateTime, Effect, Layer, Schema } from "effect";

import { CreatePersonalWorld } from "../../../../packages/contracts/src/worlds/operations.js";
import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "../../../../packages/ontology/src/commit/configuration.js";
import { ErasureAttemptRegister } from "../../../../packages/ontology/src/ports/erasure/attempt-register.js";
import { ErasureRestoreActivation } from "../../../../packages/ontology/src/ports/erasure/restore-activation.js";
import {
  DataPolicy,
  HostedRetainedDataPolicySchema,
  RetainedDataPolicySchema,
  VerifiedRequestContext,
} from "../../../../packages/ontology/src/ports/worlds/context.js";
import { digestBytes } from "../../../../packages/ontology/src/values/canonical.js";

export const installation = Schema.decodeSync(AuthorityInstallationSchema)({
  cellEpoch: "1",
  cellId: randomUUID(),
  generationId: randomUUID(),
  releaseDigest: digestBytes(
    new TextEncoder().encode("EX39 hosted local compose independent fixture")
  ),
});

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

export const hostedConfiguration = Layer.mergeAll(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, hostedRetainedPolicy),
  ErasureAttemptRegister.unqualifiedLayer,
  ErasureRestoreActivation.unqualifiedLayer
);

export const localRetainedConfiguration = Layer.mergeAll(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, localRetainedPolicy),
  ErasureAttemptRegister.unqualifiedLayer,
  ErasureRestoreActivation.unqualifiedLayer
);

export const makeContext = Effect.fn("EX39.makeContext")(function* makeContext(
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

export const makeCreateWorld = Effect.fn("EX39.makeCreateWorld")(
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
