import { randomBytes, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { WorldCreated } from "@zoen/contracts/d01/operations";
import {
  WorldErasureInspected,
  WorldErasureRequested,
} from "@zoen/contracts/erasure/operations";
import { Effect, FileSystem, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import {
  http,
  jsonBody,
  responseCookie,
  withErasableHttp,
} from "../../../server/test/composition/d01/fixture.ts";
import { saveSession } from "../../src/d01/session.js";

const read = <E, R>(stream: Stream.Stream<Uint8Array, E, R>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runCollect,
    Effect.map((parts) => parts.join(""))
  );

const json = Schema.encodeSync(Schema.fromJsonString(Schema.Unknown));
const d01 = { purpose: "personal-records", schemaVersion: "d01.v1" };

it.live(
  "EX33 compiled CLI inspects then confirms Closing over real erasable HTTP; viewer denied; replay stays Closing",
  () =>
    withErasableHttp(({ origin }) =>
      Effect.gen(function* erasureCliJourney() {
        const ownerPassword = randomBytes(24).toString("base64url");
        const ownerSignup = yield* http(
          origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Erasure owner",
            password: ownerPassword,
          })
        );
        expect(ownerSignup.status).toBe(200);
        const ownerCookie = responseCookie(ownerSignup);

        const viewerSignup = yield* http(
          origin,
          "/api/auth/sign-up/email",
          json({
            email: `${randomUUID()}@example.test`,
            name: "Erasure viewer",
            password: randomBytes(24).toString("base64url"),
          })
        );
        expect(viewerSignup.status).toBe(200);
        const viewerCookie = responseCookie(viewerSignup);
        const viewerPrincipal = Schema.decodeUnknownSync(
          Schema.Struct({
            user: Schema.Struct({ id: Schema.String.check(Schema.isUUID()) }),
          })
        )(yield* jsonBody(viewerSignup)).user.id;

        const fs = yield* FileSystem.FileSystem;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const sessionDir = yield* fs.makeTempDirectoryScoped({
          prefix: "zoen-ex33-cli-",
        });
        yield* saveSession(sessionDir, origin, ownerCookie);
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
          ownerCookie
        );
        expect(worldResponse.status).toBe(200);
        const created = Schema.decodeUnknownSync(WorldCreated)(
          yield* jsonBody(worldResponse)
        );
        const { worldRef } = created;

        // Grant viewer read via sharing HTTP so denial is membership-based.
        const grantPayload = json({
          input: {
            expectedRevision: null,
            principalRef: viewerPrincipal,
          },
          operation: "GrantWorldReadAccess",
          operationId: randomUUID(),
          purpose: "personal-records",
          schemaVersion: "d03.sharing.v1",
          worldRef,
        });
        let grant = yield* http(
          origin,
          "/api/d03/sharing",
          grantPayload,
          ownerCookie
        );
        for (
          let attempt = 0;
          attempt < 10 && grant.status === 503;
          attempt += 1
        ) {
          grant = yield* http(
            origin,
            "/api/d03/sharing",
            grantPayload,
            ownerCookie
          );
        }
        expect(grant.status).toBe(200);

        const inspected = yield* cli([
          "inspect-world-erasure",
          "--world-id",
          worldRef.worldId,
        ]);
        expect(inspected.exitCode).toBe(0);
        expect(inspected.stderr).toBe("");
        const progress = Schema.decodeUnknownSync(WorldErasureInspected)(
          JSON.parse(inspected.stdout)
        );
        expect(progress).toMatchObject({
          phase: "Active",
          restoreAfterErasure: false,
          revision: "0",
        });

        const operationId = randomUUID();
        const requested = yield* cli([
          "request-world-erasure",
          "--world-id",
          worldRef.worldId,
          "--expected-revision",
          "null",
          "--confirm-entire-world",
          "--operation-id",
          operationId,
        ]);
        expect(requested.exitCode).toBe(0);
        expect(requested.stderr).toBe("");
        const closing = Schema.decodeUnknownSync(WorldErasureRequested)(
          JSON.parse(requested.stdout)
        );
        expect(closing).toMatchObject({
          attemptExternalState: "Confirmed",
          phase: "Closing",
          restoreAfterErasure: false,
        });
        expect(closing.phase).not.toBe("Erased");
        expect(closing.phase).not.toBe("Purging");

        const replay = yield* cli([
          "request-world-erasure",
          "--world-id",
          worldRef.worldId,
          "--expected-revision",
          "null",
          "--confirm-entire-world",
          "--operation-id",
          operationId,
        ]);
        expect(replay.exitCode).toBe(0);
        const replayed = Schema.decodeUnknownSync(WorldErasureRequested)(
          JSON.parse(replay.stdout)
        );
        expect(replayed.receiptRef).toBe(closing.receiptRef);
        expect(replayed.phase).toBe("Closing");
        expect(replayed.phase).not.toBe("Erased");

        const after = yield* cli([
          "inspect-world-erasure",
          "--world-id",
          worldRef.worldId,
          "--operation-id",
          operationId,
        ]);
        expect(after.exitCode).toBe(0);
        const inspectedClosing = Schema.decodeUnknownSync(
          WorldErasureInspected
        )(JSON.parse(after.stdout));
        expect(inspectedClosing).toMatchObject({
          attemptExternalState: "Confirmed",
          phase: "Closing",
          restoreAfterErasure: false,
        });

        const denied = {
          _tag: "NotFoundOrDenied",
          code: "NOT_FOUND_OR_DENIED",
        } as const;
        const viewerInspect = yield* http(
          origin,
          "/api/erasure/execute",
          json({
            input: { operationId: null },
            operation: "InspectWorldErasure",
            purpose: "personal-records",
            schemaVersion: "erasure.v1",
            worldRef,
          }),
          viewerCookie
        );
        expect({
          body: yield* jsonBody(viewerInspect),
          status: viewerInspect.status,
        }).toStrictEqual({ body: denied, status: 404 });

        const viewerRequest = yield* http(
          origin,
          "/api/erasure/execute",
          json({
            input: {
              confirmEntireWorld: true,
              expectedErasureRevision: null,
              policyVersion: "d03-local-erasable-v1",
            },
            operation: "RequestWorldErasure",
            operationId: randomUUID(),
            purpose: "personal-records",
            schemaVersion: "erasure.v1",
            worldRef,
          }),
          viewerCookie
        );
        expect({
          body: yield* jsonBody(viewerRequest),
          status: viewerRequest.status,
        }).toStrictEqual({ body: denied, status: 404 });
      }).pipe(Effect.provide(NodeServices.layer))
    )
);
