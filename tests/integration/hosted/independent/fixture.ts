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
} from "../../../../packages/authority/src/ports/d01/context.js";
import { digestBytes } from "../../../../packages/authority/src/values/canonical.js";
import { CreatePersonalWorld } from "../../../../packages/contracts/src/d01/operations.js";

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
  profileId: "d04-hosted-retained-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
});

export const localRetainedPolicy = Schema.decodeSync(RetainedDataPolicySchema)({
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: false,
  legalHold: false,
  licensedExpiry: false,
  profileId: "d01-local-retained-v1",
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
      schemaVersion: "d01.v1",
    });
  }
);
