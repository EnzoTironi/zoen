import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { EvidenceImported, WorldCreated } from "@zoen/contracts/d01/operations";
import { SubjectKey } from "@zoen/contracts/d01/values";
import {
  IdentityProposed,
  IdentityResolved,
  SubjectIdentityInspected,
} from "@zoen/contracts/subject-identity/operations";
import { Effect, FileSystem, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import {
  http,
  jsonBody,
  responseCookie,
  withD01Http,
} from "../../../server/test/composition/d01/fixture.ts";
import { saveSession } from "../../src/d01/session.js";

const subjectKey = Schema.decodeSync(SubjectKey);

const read = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map((parts) => parts.join(""))
  );

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const d01 = { purpose: "personal-records", schemaVersion: "d01.v1" };
const interval = {
  _tag: "DateInterval",
  from: "2026-09-01",
  to: "2026-10-01",
};

const document = json({
  records: [
    {
      externalId: "row-a",
      predicate: "obligation.amount",
      subjectKey: "A",
      validTime: interval,
      value: { _tag: "Known", amount: "100.00", currency: "BRL" },
    },
    {
      externalId: "row-b",
      predicate: "obligation.amount",
      subjectKey: "B",
      validTime: interval,
      value: { _tag: "Known", amount: "120.00", currency: "BRL" },
    },
  ],
  schemaVersion: "d01.v1",
  source: {
    externalId: "billing",
    label: "Billing",
    namespace: "ex28-cli",
    revision: "1",
  },
});

const partitionAnchorAway = (
  frame: (typeof SubjectIdentityInspected.Type)["frame"],
  anchor: typeof SubjectKey.Type
) =>
  frame.cells.map((cell) => {
    const component = cell.components.find((item) =>
      item.members.includes(anchor)
    );
    if (component === undefined) {
      throw new Error(`missing component for ${anchor}`);
    }
    const others = component.members.filter((member) => member !== anchor);
    const blocks =
      others.length === 0 ? [[...component.members]] : [[anchor], [...others]];
    return { blocks, cellRef: cell.cellRef };
  });

it.live(
  "EX28 compiled CLI inspects, proposes same-as, resolves, splits and recovers over real HTTP",
  () =>
    withD01Http(({ origin }) =>
      Effect.gen(function* identityCliJourney() {
        const signup = yield* http(
          origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Identity owner",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(signup.status).toBe(200);
        const cookie = responseCookie(signup);
        const fs = yield* FileSystem.FileSystem;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const sessionDir = yield* fs.makeTempDirectoryScoped({
          prefix: "zoen-ex28-cli-",
        });
        yield* saveSession(sessionDir, origin, cookie);
        const cli = (args: readonly string[]) =>
          Effect.gen(function* runRealCli() {
            const child = yield* spawner.spawn(
              ChildProcess.make(process.execPath, [
                fileURLToPath(new URL("../../dist/main.js", import.meta.url)),
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
          }).pipe(Effect.scoped, Effect.timeout("35 seconds"));

        const worldResponse = yield* http(
          origin,
          "/api/d01/execute",
          json({
            ...d01,
            input: {},
            operation: "CreatePersonalWorld",
            operationId: randomUUID(),
          }),
          cookie
        );
        expect(worldResponse.status).toBe(200);
        const created = Schema.decodeUnknownSync(WorldCreated)(
          yield* jsonBody(worldResponse)
        );
        const { worldRef } = created;
        const imported = yield* http(
          origin,
          "/api/d01/execute",
          json({
            ...d01,
            input: { document },
            operation: "ImportEvidence",
            operationId: randomUUID(),
            worldRef,
          }),
          cookie
        );
        expect(imported.status).toBe(200);
        Schema.decodeUnknownSync(EvidenceImported)(yield* jsonBody(imported));

        const inspected = yield* cli([
          "inspect-identity",
          "--world-id",
          worldRef.worldId,
          "--anchors",
          "A,B",
          "--valid-from",
          "2026-09-01",
          "--valid-to",
          "2026-10-01",
        ]);
        expect(inspected.exitCode).toBe(0);
        expect(inspected.stderr).toBe("");
        const frameResult = Schema.decodeUnknownSync(SubjectIdentityInspected)(
          JSON.parse(inspected.stdout)
        );
        expect(frameResult.frame.kind).toBe("subject-identity");
        expect(frameResult.frame.closureAnchors).toStrictEqual(["A", "B"]);

        const proposeId = randomUUID();
        const proposed = yield* cli([
          "propose-same-as",
          "--world-id",
          worldRef.worldId,
          "--frame-ref",
          frameResult.frame.frameRef,
          "--left",
          "A",
          "--right",
          "B",
          "--operation-id",
          proposeId,
        ]);
        expect(proposed.exitCode).toBe(0);
        const question = Schema.decodeUnknownSync(IdentityProposed)(
          JSON.parse(proposed.stdout)
        );
        expect(question.question.kind).toBe("identity-resolution");

        const resolved = yield* cli([
          "resolve-identity",
          "--world-id",
          worldRef.worldId,
          "--question-ref",
          question.question.questionRef,
          "--consequence-digest",
          question.question.consequenceDigest,
          "--answer",
          "same-as",
          "--operation-id",
          randomUUID(),
        ]);
        expect(resolved.exitCode).toBe(0);
        const applied = Schema.decodeUnknownSync(IdentityResolved)(
          JSON.parse(resolved.stdout)
        );
        expect(applied.outcome).toBe("applied");
        expect(applied.decisionRef).not.toBeNull();

        const merged = yield* cli([
          "inspect-identity",
          "--world-id",
          worldRef.worldId,
          "--anchors",
          "A,B",
          "--valid-from",
          "2026-09-01",
          "--valid-to",
          "2026-10-01",
        ]);
        expect(merged.exitCode).toBe(0);
        const mergedFrame = Schema.decodeUnknownSync(SubjectIdentityInspected)(
          JSON.parse(merged.stdout)
        );
        expect(
          mergedFrame.frame.cells.some((cell) =>
            cell.components.some(
              (component) =>
                component.members.includes(subjectKey("A")) &&
                component.members.includes(subjectKey("B"))
            )
          )
        ).toBeTruthy();

        const partitions = partitionAnchorAway(
          mergedFrame.frame,
          subjectKey("A")
        );
        const splitProposed = yield* cli([
          "propose-identity-split",
          "--world-id",
          worldRef.worldId,
          "--frame-ref",
          mergedFrame.frame.frameRef,
          "--anchor",
          "A",
          "--partitions-json",
          JSON.stringify(partitions),
          "--operation-id",
          randomUUID(),
        ]);
        expect(splitProposed.exitCode).toBe(0);
        const splitQuestion = Schema.decodeUnknownSync(IdentityProposed)(
          JSON.parse(splitProposed.stdout)
        );
        expect(splitQuestion.question.kind).toBe("identity-split");

        const splitResolved = yield* cli([
          "resolve-identity",
          "--world-id",
          worldRef.worldId,
          "--question-ref",
          splitQuestion.question.questionRef,
          "--consequence-digest",
          splitQuestion.question.consequenceDigest,
          "--answer",
          "confirm",
          "--operation-id",
          randomUUID(),
        ]);
        expect(splitResolved.exitCode).toBe(0);
        expect(
          Schema.decodeUnknownSync(IdentityResolved)(
            JSON.parse(splitResolved.stdout)
          ).outcome
        ).toBe("applied");

        const recovery = yield* cli([
          "inspect-identity-recovery",
          "--world-id",
          worldRef.worldId,
          "--anchor",
          "A",
          "--valid-from",
          "2026-09-01",
          "--valid-to",
          "2026-10-01",
          "--target-decision-ref",
          String(applied.decisionRef),
        ]);
        expect(recovery.exitCode).toBe(0);
        const recoveryJson = Schema.decodeUnknownSync(
          Schema.Struct({
            frame: Schema.Struct({
              comparison: Schema.String,
              kind: Schema.String,
            }),
          })
        )(JSON.parse(recovery.stdout));
        expect(recoveryJson.frame.kind).toBe("subject-identity-recovery");
        expect(recoveryJson.frame.comparison).toBe("not-requested");
        expect(recoveryJson.frame).not.toHaveProperty("claims");
      }).pipe(Effect.provide(NodeServices.layer))
    )
);
