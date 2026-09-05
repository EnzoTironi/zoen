import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import {
  CorrectionApplied,
  CorrectionProposed,
  CorrectionUndone,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/d01/operations";
import { Effect, FileSystem, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { SqlClient } from "effect/unstable/sql";

import {
  http,
  jsonBody,
  responseCookie,
  withD01Http,
} from "../../../../server/test/composition/d01/fixture.ts";
import { saveSession } from "../../../src/d01/session.js";

const read = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map((parts) => parts.join(""))
  );

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const envelope = { purpose: "personal-records", schemaVersion: "d01.v1" };
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
    schemaVersion: "d01.v1",
    source: {
      externalId: "source-a",
      label: "Invoice source",
      namespace: "http-corrections",
      revision,
    },
  });

it.live(
  "EX14 compiled CLI preserves correction consent, replay, undo and typed stale or revoked failures",
  () =>
    withD01Http(({ database, origin }) =>
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
        const fs = yield* FileSystem.FileSystem;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const sessionDir = yield* fs.makeTempDirectoryScoped({
          prefix: "zoen-ex14-cli-",
        });
        yield* saveSession(sessionDir, origin, cookie);
        const cli = (args: readonly string[]) =>
          Effect.gen(function* runRealCli() {
            const child = yield* spawner.spawn(
              ChildProcess.make(process.execPath, [
                fileURLToPath(
                  new URL("../../../dist/main.js", import.meta.url)
                ),
                "--base-url",
                origin,
                "--session-dir",
                sessionDir,
                ...args,
              ])
            );
            return yield* Effect.all(
              {
                exitCode: child.exitCode,
                stderr: read(child.stderr),
                stdout: read(child.stdout),
              },
              { concurrency: "unbounded" }
            );
          });
        const correction = (
          request:
            | ReturnType<typeof proposeRequest>
            | {
                operation: string;
                operationId: string;
                worldRef: typeof worldRef;
                input: {
                  answer: string;
                  questionRef: string;
                  consequenceDigest: string;
                };
              }
            | {
                operation: string;
                operationId: string;
                worldRef: typeof worldRef;
                input: { correctionRef: string; frameRef: string };
              }
        ) => {
          const { input } = request;
          const args = [
            "--world-id",
            request.worldRef.worldId,
            "--operation-id",
            request.operationId,
          ];
          if ("consequence" in input) {
            return cli([
              "propose-correction",
              ...args,
              "--frame-ref",
              input.frameRef,
              "--subject-key",
              input.consequence.subjectKey,
              "--valid-from",
              input.consequence.validTime.from,
              "--valid-to",
              input.consequence.validTime.to,
              "--choice",
              "select-claim",
              "--claim-ref",
              input.consequence.choice.claimRef,
            ]);
          }
          if ("questionRef" in input) {
            return cli([
              "answer-question",
              ...args,
              "--question-ref",
              input.questionRef,
              "--consequence-digest",
              input.consequenceDigest,
              "--answer",
              input.answer,
            ]);
          }
          return cli([
            "undo-correction",
            ...args,
            "--frame-ref",
            input.frameRef,
            "--correction-ref",
            input.correctionRef,
          ]);
        };

        const worldResponse = yield* http(
          origin,
          "/api/d01/execute",
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
          "/api/d01/execute",
          json(importRequest("1")),
          cookie
        );
        expect(imported.status).toBe(200);
        const inspect = (atFrame: string | null = null) =>
          http(
            origin,
            "/api/d01/execute",
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
        const invalid = yield* cli([
          "propose-correction",
          "--world-id",
          worldRef.worldId,
          "--operation-id",
          randomUUID(),
          "--frame-ref",
          original.frame.frameRef,
          "--subject-key",
          "invoice-a",
          "--valid-from",
          validTime.from,
          "--valid-to",
          validTime.to,
          "--choice",
          "select-claim",
        ]);
        expect(invalid).toStrictEqual({
          exitCode: 2,
          stderr: '{"_tag":"CliFailure","code":"CLI_INPUT"}\n',
          stdout: "",
        });
        const proposalRequest = proposeRequest(original.frame.frameRef);
        const proposedResponse = yield* correction(proposalRequest);
        expect(proposedResponse.exitCode).toBe(0);
        const proposed = yield* Schema.decodeEffect(
          Schema.fromJsonString(CorrectionProposed)
        )(proposedResponse.stdout);
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
        const answeredResponse = yield* correction(answerRequest);
        expect(answeredResponse.exitCode).toBe(0);
        const applied = yield* Schema.decodeEffect(
          Schema.fromJsonString(CorrectionApplied)
        )(answeredResponse.stdout);
        const replay = yield* correction(answerRequest);
        expect(replay).toStrictEqual(answeredResponse);
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
        const undoResponse = yield* correction({
          input: {
            correctionRef: applied.correctionRef,
            frameRef: corrected.frame.frameRef,
          },
          operation: "UndoCorrection",
          operationId: randomUUID(),
          worldRef,
        });
        expect(undoResponse.exitCode).toBe(0);
        yield* Schema.decodeEffect(Schema.fromJsonString(CorrectionUndone))(
          undoResponse.stdout
        );
        const undone = yield* inspect();
        expect(undone.frame.scopedCorrections).toStrictEqual([]);
        expect((yield* inspect(corrected.frame.frameRef)).frame).toStrictEqual(
          corrected.frame
        );
        const pendingResponse = yield* correction(
          proposeRequest(undone.frame.frameRef)
        );
        const pending = yield* Schema.decodeEffect(
          Schema.fromJsonString(CorrectionProposed)
        )(pendingResponse.stdout);
        const changed = yield* http(
          origin,
          "/api/d01/execute",
          json(importRequest("2")),
          cookie
        );
        expect(changed.status).toBe(200);
        const stale = yield* correction({
          ...answerRequest,
          input: {
            answer: "unknown",
            consequenceDigest: pending.consequenceDigest,
            questionRef: pending.questionRef,
          },
          operationId: randomUUID(),
        });
        expect(stale).toStrictEqual({
          exitCode: 1,
          stderr: '{"_tag":"Stale","code":"STALE"}\n',
          stdout: "",
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
        const denied = yield* correction(answerRequest);
        expect(denied).toStrictEqual({
          exitCode: 1,
          stderr: '{"_tag":"NotFoundOrDenied","code":"NOT_FOUND_OR_DENIED"}\n',
          stdout: "",
        });
      }).pipe(Effect.provide(NodeServices.layer))
    )
);
