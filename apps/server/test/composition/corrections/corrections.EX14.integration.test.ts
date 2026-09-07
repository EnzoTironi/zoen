import { randomBytes, randomUUID } from "node:crypto";

import { expect, it } from "@effect/vitest";
import {
  CorrectionApplied,
  CorrectionProposed,
  CorrectionUndone,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import { Effect, Schema } from "effect";
import { SqlClient } from "effect/unstable/sql";

import {
  http,
  jsonBody,
  responseCookie,
  withWorldsHttp,
} from "../worlds/fixture.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const envelope = { purpose: "personal-records", schemaVersion: "worlds.v1" };
const path = "/api/corrections/execute";
const validTime = {
  _tag: "DateInterval",
  from: "2026-09-01",
  to: "2026-10-01",
};
const document = (revision: string) =>
  json({
    records: [
      {
        externalId: "invoice-a",
        predicate: "obligation.amount",
        subjectKey: "invoice-a",
        validTime,
        value: { _tag: "Known", amount: "100.00", currency: "BRL" },
      },
    ],
    schemaVersion: "worlds.v1",
    source: {
      externalId: "source-a",
      label: "Invoice source",
      namespace: "http-corrections",
      revision,
    },
  });

it.live(
  "EX14 HTTP binds correction consent, preserves replay and history, and rejects stale or revoked disclosure",
  () =>
    withWorldsHttp(({ database, origin }) =>
      Effect.gen(function* correctionHttpJourney() {
        const signup = yield* http(
          origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Correction owner",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(signup.status).toBe(200);
        const cookie = responseCookie(signup);
        const worldResponse = yield* http(
          origin,
          "/api/worlds/execute",
          json({
            ...envelope,
            input: {},
            operation: "CreatePersonalWorld",
            operationId: randomUUID(),
          }),
          cookie
        );
        const { worldRef } = yield* jsonBody(worldResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated))
        );
        const importRequest = (revision: string) => ({
          ...envelope,
          input: { document: document(revision) },
          operation: "ImportEvidence",
          operationId: randomUUID(),
          worldRef,
        });
        const imported = yield* http(
          origin,
          "/api/worlds/execute",
          json(importRequest("1")),
          cookie
        );
        expect(imported.status).toBe(200);
        const inspect = (atFrame: string | null = null) =>
          http(
            origin,
            "/api/worlds/execute",
            json({
              ...envelope,
              input: { atFrame, subjectKey: "invoice-a" },
              operation: "Inspect",
              worldRef,
            }),
            cookie
          ).pipe(
            Effect.flatMap(jsonBody),
            Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
          );
        const original = yield* inspect();
        const [claim] = original.frame.claims;
        if (claim === undefined) {
          throw new Error("Real import must create a claim");
        }
        const proposeRequest = (frameRef: string) => ({
          ...envelope,
          input: {
            consequence: {
              choice: { _tag: "selectClaim", claimRef: claim.claimRef },
              subjectKey: "invoice-a",
              validTime,
            },
            frameRef,
          },
          operation: "ProposeCorrection",
          operationId: randomUUID(),
          worldRef,
        });
        const proposalRequest = proposeRequest(original.frame.frameRef);
        const proposedResponse = yield* http(
          origin,
          path,
          json(proposalRequest),
          cookie
        );
        expect(proposedResponse.status).toBe(200);
        const proposed = yield* jsonBody(proposedResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
        );
        expect(proposed.consequence).toStrictEqual(
          proposalRequest.input.consequence
        );
        const answerRequest = {
          ...envelope,
          input: {
            answer: "confirm",
            consequenceDigest: proposed.consequenceDigest,
            questionRef: proposed.questionRef,
          },
          operation: "AnswerQuestion",
          operationId: randomUUID(),
          worldRef,
        };
        const answeredResponse = yield* http(
          origin,
          path,
          json(answerRequest),
          cookie
        );
        expect(answeredResponse.status).toBe(200);
        const applied = yield* jsonBody(answeredResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CorrectionApplied))
        );
        const replay = yield* http(origin, path, json(answerRequest), cookie);
        expect(yield* jsonBody(replay)).toStrictEqual(applied);
        const corrected = yield* inspect();
        expect(corrected.frame.scopedCorrections).toStrictEqual([
          {
            authoredBy: "current-principal",
            choice: proposalRequest.input.consequence.choice,
            correctionRef: applied.correctionRef,
            receiptRef: applied.receiptRef,
            subjectKey: "invoice-a",
            validTime,
          },
        ]);
        expect((yield* inspect(original.frame.frameRef)).frame).toStrictEqual(
          original.frame
        );
        const undoResponse = yield* http(
          origin,
          path,
          json({
            ...envelope,
            input: {
              correctionRef: applied.correctionRef,
              frameRef: corrected.frame.frameRef,
            },
            operation: "UndoCorrection",
            operationId: randomUUID(),
            worldRef,
          }),
          cookie
        );
        expect(undoResponse.status).toBe(200);
        yield* jsonBody(undoResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CorrectionUndone))
        );
        const undone = yield* inspect();
        expect(undone.frame.scopedCorrections).toStrictEqual([]);
        expect((yield* inspect(corrected.frame.frameRef)).frame).toStrictEqual(
          corrected.frame
        );
        const pendingResponse = yield* http(
          origin,
          path,
          json(proposeRequest(undone.frame.frameRef)),
          cookie
        );
        const pending = yield* jsonBody(pendingResponse).pipe(
          Effect.flatMap(Schema.decodeUnknownEffect(CorrectionProposed))
        );
        const changed = yield* http(
          origin,
          "/api/worlds/execute",
          json(importRequest("2")),
          cookie
        );
        expect(changed.status).toBe(200);
        const stale = yield* http(
          origin,
          path,
          json({
            ...answerRequest,
            input: {
              answer: "unknown",
              consequenceDigest: pending.consequenceDigest,
              questionRef: pending.questionRef,
            },
            operationId: randomUUID(),
          }),
          cookie
        );
        expect({
          body: yield* jsonBody(stale),
          status: stale.status,
        }).toStrictEqual({
          body: { _tag: "Stale", code: "STALE" },
          status: 409,
        });
        const events = yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`SELECT count(*)::int AS count FROM authority.corrections WHERE world_id = ${worldRef.worldId}`
        ).pipe(Effect.provide(database.authority));
        expect(events).toStrictEqual([{ count: 2 }]);
        yield* SqlClient.SqlClient.use(
          (sql) =>
            sql`UPDATE authority.memberships SET state = 'revoked', revision = revision + 1 WHERE world_id = ${worldRef.worldId}`
        ).pipe(Effect.provide(database.authority));
        const denied = yield* http(origin, path, json(answerRequest), cookie);
        expect({
          body: yield* jsonBody(denied),
          status: denied.status,
        }).toStrictEqual({
          body: { _tag: "NotFoundOrDenied", code: "NOT_FOUND_OR_DENIED" },
          status: 404,
        });
      })
    )
);

it.live(
  "EX14 correction HTTP keeps strict original bytes and audience checks",
  () =>
    withWorldsHttp(({ origin }) =>
      Effect.gen(function* correctionHttpBoundaries() {
        const duplicate = yield* http(
          origin,
          path,
          '{"operation":"ProposeCorrection","operation":"AnswerQuestion"}'
        );
        expect({
          body: yield* jsonBody(duplicate),
          status: duplicate.status,
        }).toStrictEqual({
          body: { _tag: "InvalidInput", code: "INVALID_INPUT" },
          status: 400,
        });
        const foreign = yield* http(
          origin,
          path,
          "{}",
          undefined,
          "https://foreign.example"
        );
        expect(foreign.status).toBe(404);
      })
    )
);
