import { describe, expect, it } from "@effect/vitest";
import {
  CreatePersonalWorld,
  ImportEvidence,
} from "@zoen/contracts/d01/operations";
import { Effect, Schema } from "effect";

import { requireSameIntent } from "../../src/commit/idempotency.js";
import { bindWorldIntent } from "../../src/commit/intent.js";
import { intentDigest } from "../../src/values/canonical.js";

const operationId = "00000000-0000-4000-8000-000000000002";
const envelope = {
  operationId,
  purpose: "personal-records",
  schemaVersion: "d01.v1",
} as const;
const originalDocument =
  '{"schemaVersion":"d01.v1","source":{"namespace":"test","externalId":"test","revision":"1","label":"test"},"records":[{"externalId":"one","subjectKey":"one","predicate":"obligation.amount","validTime":{"_tag":"Unknown"},"value":{"_tag":"Known","amount":"100.00","currency":"BRL"}}]}';

describe("EX05 bound intent", () => {
  it.effect("binds equal requests to one digest", () =>
    Effect.gen(function* equalRequests() {
      const request = yield* Schema.decodeEffect(CreatePersonalWorld)({
        ...envelope,
        input: {},
        operation: "CreatePersonalWorld",
      });
      const first = yield* intentDigest(request);
      const second = yield* intentDigest({ ...request });
      yield* requireSameIntent(first, second);
      expect(first).toBe(second);
    })
  );
  it.effect(
    "rejects changed value under the same world, actor scope and operation ID",
    () =>
      Effect.gen(function* changedValue() {
        const request = yield* Schema.decodeEffect(ImportEvidence)({
          ...envelope,
          input: { document: originalDocument },
          operation: "ImportEvidence",
          worldRef: {
            realm: "live",
            worldId: "00000000-0000-4000-8000-000000000003",
          },
        });
        const first = yield* bindWorldIntent(request);
        const changed = yield* bindWorldIntent({
          ...request,
          input: { document: originalDocument.replace("100.00", "200.00") },
        });
        const error = yield* requireSameIntent(
          first.digest,
          changed.digest
        ).pipe(Effect.flip);
        expect(error).toMatchObject({ _tag: "Conflict", code: "CONFLICT" });
      })
  );
});
