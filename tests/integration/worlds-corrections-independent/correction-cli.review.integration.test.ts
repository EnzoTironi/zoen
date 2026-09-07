import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import {
  CorrectionProposed,
  FrameInspected,
  WorldCreated,
} from "@zoen/contracts/worlds/operations";
import { Effect, FileSystem, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import { SqlClient } from "effect/unstable/sql";

import { saveSession } from "../../../apps/cli/src/worlds/session.ts";
import {
  http,
  jsonBody,
  responseCookie,
  withD01Http,
} from "../../../apps/server/test/composition/worlds/fixture.ts";

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const text = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map((parts) => parts.join(""))
  );

it.live(
  "independent EX14 CLI requires explicit mutation identity and answer, unknown stays scoped, and changed digest or reused identity cannot change consent",
  () =>
    withD01Http(({ database, origin }) =>
      Effect.gen(function* correctionCliReview() {
        const signup = yield* http(
          origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Independent correction review",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(signup.status).toBe(200);
        const cookie = responseCookie(signup);
        const fs = yield* FileSystem.FileSystem;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const sessionDir = yield* fs.makeTempDirectoryScoped({
          prefix: "zoen-ex14-review-",
        });
        yield* saveSession(sessionDir, origin, cookie);
        const cli = (args: readonly string[]) =>
          Effect.gen(function* cliProcess() {
            const child = yield* spawner.spawn(
              ChildProcess.make(
                process.execPath,
                [
                  fileURLToPath(
                    new URL("../../../apps/cli/dist/main.js", import.meta.url)
                  ),
                  "--base-url",
                  origin,
                  "--session-dir",
                  sessionDir,
                  ...args,
                ],
                { forceKillAfter: "500 millis" }
              )
            );
            return yield* Effect.all(
              {
                exitCode: child.exitCode,
                stderr: text(child.stderr),
                stdout: text(child.stdout),
              },
              { concurrency: "unbounded" }
            ).pipe(Effect.timeout("8 seconds"));
          });
        const envelope = {
          purpose: "personal-records",
          schemaVersion: "worlds.v1",
        };
        const { worldRef } = yield* http(
          origin,
          "/api/worlds/execute",
          json({
            ...envelope,
            input: {},
            operation: "CreatePersonalWorld",
            operationId: randomUUID(),
          }),
          cookie
        ).pipe(
          Effect.flatMap(jsonBody),
          Effect.flatMap(Schema.decodeUnknownEffect(WorldCreated))
        );
        const validTime = {
          _tag: "DateInterval",
          from: "2026-09-01",
          to: "2026-10-01",
        };
        const document = json({
          records: [
            {
              externalId: "one",
              predicate: "obligation.amount",
              subjectKey: "review-obligation",
              validTime,
              value: { _tag: "Known", amount: "100", currency: "BRL" },
            },
          ],
          schemaVersion: "worlds.v1",
          source: {
            externalId: "review-source",
            label: "Review",
            namespace: "review",
            revision: "1",
          },
        });
        expect(
          (yield* http(
            origin,
            "/api/worlds/execute",
            json({
              ...envelope,
              input: { document },
              operation: "ImportEvidence",
              operationId: randomUUID(),
              worldRef,
            }),
            cookie
          )).status
        ).toBe(200);
        const inspect = () =>
          http(
            origin,
            "/api/worlds/execute",
            json({
              ...envelope,
              input: { atFrame: null, subjectKey: "review-obligation" },
              operation: "Inspect",
              worldRef,
            }),
            cookie
          ).pipe(
            Effect.flatMap(jsonBody),
            Effect.flatMap(Schema.decodeUnknownEffect(FrameInspected))
          );
        const before = yield* inspect();
        const [claim] = before.frame.claims;
        if (claim === undefined) {
          return yield* Effect.die("Real imported claim required");
        }
        const args = [
          "propose-correction",
          "--world-id",
          worldRef.worldId,
          "--frame-ref",
          before.frame.frameRef,
          "--subject-key",
          "review-obligation",
          "--valid-from",
          validTime.from,
          "--valid-to",
          validTime.to,
          "--choice",
          "unknown",
        ];
        const missingIdentity = yield* cli(args);
        expect(missingIdentity.exitCode).not.toBe(0);
        expect(missingIdentity.stdout).toBe("");
        const invalidChoice = yield* cli([
          ...args,
          "--operation-id",
          randomUUID(),
          "--claim-ref",
          claim.claimRef,
        ]);
        expect(invalidChoice).toStrictEqual({
          exitCode: 2,
          stderr: '{"_tag":"CliFailure","code":"CLI_INPUT"}\n',
          stdout: "",
        });
        const cases = SqlClient.SqlClient.use(
          (sql) =>
            sql`SELECT count(*)::int AS cases, (SELECT count(*)::int FROM authority.corrections) AS corrections FROM authority.cases`
        ).pipe(Effect.provide(database.authority));
        expect(yield* cases).toStrictEqual([{ cases: 0, corrections: 0 }]);
        const proposalId = randomUUID();
        const proposedProcess = yield* cli([
          ...args,
          "--operation-id",
          proposalId,
        ]);
        expect({
          exitCode: proposedProcess.exitCode,
          stderr: proposedProcess.stderr,
        }).toStrictEqual({ exitCode: 0, stderr: "" });
        const proposal = yield* Schema.decodeEffect(
          Schema.fromJsonString(CorrectionProposed)
        )(proposedProcess.stdout);
        expect(proposal.consequence).toStrictEqual({
          choice: { _tag: "unknown" },
          subjectKey: "review-obligation",
          validTime,
        });
        expect((yield* inspect()).frame.scopedCorrections).toStrictEqual([]);
        const answerId = randomUUID();
        const answerArgs = [
          "answer-question",
          "--world-id",
          worldRef.worldId,
          "--operation-id",
          answerId,
          "--question-ref",
          proposal.questionRef,
        ];
        const omitted = yield* cli([
          ...answerArgs,
          "--consequence-digest",
          proposal.consequenceDigest,
        ]);
        expect(omitted.exitCode).not.toBe(0);
        expect(omitted.stdout).toBe("");
        const wrongDigest = `${proposal.consequenceDigest.startsWith("a") ? "b" : "a"}${proposal.consequenceDigest.slice(1)}`;
        expect(
          yield* cli([
            ...answerArgs,
            "--consequence-digest",
            wrongDigest,
            "--answer",
            "confirm",
          ])
        ).toStrictEqual({
          exitCode: 1,
          stderr: '{"_tag":"Conflict","code":"CONFLICT"}\n',
          stdout: "",
        });
        expect(yield* cases).toStrictEqual([{ cases: 1, corrections: 0 }]);
        const confirmArgs = [
          ...answerArgs,
          "--consequence-digest",
          proposal.consequenceDigest,
          "--answer",
          "confirm",
        ];
        const confirmed = yield* cli(confirmArgs);
        expect({
          exitCode: confirmed.exitCode,
          stderr: confirmed.stderr,
        }).toStrictEqual({ exitCode: 0, stderr: "" });
        expect(yield* cli(confirmArgs)).toStrictEqual(confirmed);
        expect(
          yield* cli([
            ...answerArgs,
            "--consequence-digest",
            proposal.consequenceDigest,
            "--answer",
            "unknown",
          ])
        ).toStrictEqual({
          exitCode: 1,
          stderr: '{"_tag":"Conflict","code":"CONFLICT"}\n',
          stdout: "",
        });
        const after = yield* inspect();
        expect(after.frame.scopedCorrections).toMatchObject([
          {
            choice: { _tag: "unknown" },
            subjectKey: "review-obligation",
            validTime,
          },
        ]);
        expect(after.frame.claims).toStrictEqual(before.frame.claims);
        expect(after.frame.selection).toStrictEqual(before.frame.selection);
        expect(yield* cases).toStrictEqual([{ cases: 1, corrections: 1 }]);
        return null;
      }).pipe(Effect.provide(NodeServices.layer))
    )
);

it.live(
  "independent EX14 explicit correction help remains discoverable without credentials",
  () =>
    Effect.scoped(
      Effect.gen(function* correctionHelp() {
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        for (const command of [
          "propose-correction",
          "answer-question",
          "undo-correction",
        ]) {
          const child = yield* spawner.spawn(
            ChildProcess.make(process.execPath, [
              fileURLToPath(
                new URL("../../../apps/cli/dist/main.js", import.meta.url)
              ),
              command,
              "--help",
            ])
          );
          const result = yield* Effect.all(
            {
              exitCode: child.exitCode,
              stderr: text(child.stderr),
              stdout: text(child.stdout),
            },
            { concurrency: "unbounded" }
          );
          expect({
            exitCode: result.exitCode,
            stderr: result.stderr,
          }).toStrictEqual({ exitCode: 0, stderr: "" });
          expect(result.stdout).toContain(`zoen ${command}`);
          expect(result.stdout).toContain("EXAMPLES");
        }
      })
    ).pipe(Effect.provide(NodeServices.layer))
);
