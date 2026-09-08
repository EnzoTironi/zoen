import { randomUUID } from "node:crypto";

import { DateTime, Effect, Layer, Schema } from "effect";

import {
  AuthorityInstallation,
  AuthorityInstallationSchema,
} from "../../../../packages/authority/src/commit/configuration.js";
import { ErasureAttemptRegister } from "../../../../packages/authority/src/ports/erasure/attempt-register.js";
import { ErasureCopyCatalog } from "../../../../packages/authority/src/ports/erasure/copy-catalog.js";
import { ErasureObjectInventory } from "../../../../packages/authority/src/ports/erasure/inventory.js";
import { ErasurePurgeStore } from "../../../../packages/authority/src/ports/erasure/purge.js";
import {
  DataPolicy,
  DataPolicySchema,
  VerifiedRequestContext,
} from "../../../../packages/authority/src/ports/worlds/context.js";
import { digestBytes } from "../../../../packages/authority/src/values/canonical.js";
import { CreatePersonalWorld } from "../../../../packages/contracts/src/worlds/operations.js";

const installation = Schema.decodeSync(AuthorityInstallationSchema)({
  cellEpoch: "1",
  cellId: randomUUID(),
  generationId: randomUUID(),
  releaseDigest: digestBytes(
    new TextEncoder().encode(
      "EX05 integration fixture: private-world genesis implementation"
    )
  ),
});
const policy = Schema.decodeSync(DataPolicySchema)({
  dataScope: "admitted-non-sensitive",
  enabledRealm: "live",
  erasure: false,
  legalHold: false,
  licensedExpiry: false,
  profileId: "worlds-local-retained-v1",
  restoreAfterErasure: false,
  retention: "while-pinned",
});
export const configuration = Layer.mergeAll(
  Layer.succeed(AuthorityInstallation, installation),
  Layer.succeed(DataPolicy, policy),
  ErasureAttemptRegister.unqualifiedLayer,
  ErasureCopyCatalog.unqualifiedLayer,
  ErasureObjectInventory.unqualifiedLayer,
  ErasurePurgeStore.unqualifiedLayer
);

export const makeInput = Effect.fn("EX05.makeInput")(function* makeInput() {
  const now = yield* DateTime.now;
  const context = yield* Schema.decodeEffect(VerifiedRequestContext)({
    deadline: DateTime.formatIso(DateTime.add(now, { seconds: 30 })),
    presence: {
      authenticatedAt: DateTime.formatIso(
        DateTime.subtract(now, { seconds: 1 })
      ),
      expiresAt: DateTime.formatIso(DateTime.add(now, { minutes: 1 })),
      principalId: randomUUID(),
      realm: "live",
      sessionId: randomUUID(),
    },
    purpose: "personal-records",
  });
  const request = yield* Schema.decodeEffect(CreatePersonalWorld)({
    input: {},
    operation: "CreatePersonalWorld",
    operationId: randomUUID(),
    purpose: "personal-records",
    schemaVersion: "worlds.v1",
  });
  return { context, request };
});
