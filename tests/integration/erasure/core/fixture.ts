import { randomUUID } from "node:crypto";

import { DateTime, Effect, Layer, Schema } from "effect";

import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "../../../../packages/authority/src/commit/configuration.js";
import {
  DataPolicy,
  ErasableDataPolicySchema,
  RetainedDataPolicySchema,
  VerifiedRequestContext,
} from "../../../../packages/authority/src/ports/d01/context.js";
import { digestBytes } from "../../../../packages/authority/src/values/canonical.js";

export const installation = Schema.decodeSync(AuthorityInstallationSchema)({
  cellEpoch: "1",
  cellId: randomUUID(),
  generationId: randomUUID(),
  releaseDigest: digestBytes(
    new TextEncoder().encode("EX32 erasure Closing fixture")
  ),
});

export const retainedPolicy = Schema.decodeSync(RetainedDataPolicySchema)({
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: false,
  legalHold: false,
  licensedExpiry: false,
  profileId: "d01-local-retained-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
});

export const erasablePolicy = Schema.decodeSync(ErasableDataPolicySchema)({
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: true,
  legalHold: false,
  licensedExpiry: false,
  profileId: "d03-local-erasable-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
});

export const erasableConfiguration = Layer.merge(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, erasablePolicy)
);

export const retainedConfiguration = Layer.merge(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, retainedPolicy)
);

export const makeContext = Effect.fn("EX32.makeContext")(function* makeContext(
  principalId = randomUUID()
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
