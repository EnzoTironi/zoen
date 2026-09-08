import { randomUUID } from "node:crypto";

import { DateTime, Effect, Layer, Schema } from "effect";

import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "../../../../packages/authority/src/commit/configuration.js";
import { ErasureAttemptRegister } from "../../../../packages/authority/src/ports/erasure/attempt-register.js";
import { ErasureCopyCatalog } from "../../../../packages/authority/src/ports/erasure/copy-catalog.js";
import { ErasureRestoreActivation } from "../../../../packages/authority/src/ports/erasure/restore-activation.js";
import {
  DataPolicy,
  ErasableDataPolicySchema,
  RetainedDataPolicySchema,
  VerifiedRequestContext,
} from "../../../../packages/authority/src/ports/worlds/context.js";
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
  profileId: "worlds-local-retained-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
});

export const erasablePolicy = Schema.decodeSync(ErasableDataPolicySchema)({
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: true,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-local-erasable-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
});

export const erasableConfiguration = Layer.mergeAll(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, erasablePolicy),
  ErasureRestoreActivation.unqualifiedLayer
);

export const retainedConfiguration = Layer.mergeAll(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, retainedPolicy),
  ErasureAttemptRegister.unqualifiedLayer,
  ErasureRestoreActivation.unqualifiedLayer
);

export const makeContext = Effect.fn("EX32.makeContext")(function* makeContext(
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

/** Empty BoundedComplete cut for purge handlers under ZA-12. */
export const admitEmptyCopyCatalog = (profileId = "worlds-local-erasable-v1") =>
  Effect.gen(function* admit() {
    const catalog = yield* ErasureCopyCatalog;
    yield* catalog.setCoverage(
      profileId,
      "BoundedComplete",
      `test/admit-empty/${profileId}`
    );
  });
