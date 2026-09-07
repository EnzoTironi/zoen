import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Conflict } from "@zoen/contracts/worlds/errors";
import { WorldCreated } from "@zoen/contracts/worlds/operations";
import { Effect, FileSystem, Path, Redacted, Schema } from "effect";

import { readInput, validateBaseUrl } from "../../src/worlds/input.js";
import {
  CliFailure,
  formatFailure,
  formatSuccess,
} from "../../src/worlds/output.js";
import {
  readSession,
  removeSession,
  saveSession,
} from "../../src/worlds/session.js";

describe("EX11 CLI formatting and local boundaries", () => {
  it("preserves the public success result and emits a nonzero typed error without internals", () => {
    const result = Schema.decodeSync(WorldCreated)({
      _tag: "WorldCreated",
      receiptRef: "11111111-1111-4111-8111-111111111111",
      worldRef: {
        realm: "live",
        worldId: "22222222-2222-4222-8222-222222222222",
      },
    });
    expect(JSON.parse(formatSuccess(result))).toStrictEqual(result);
    expect(formatFailure(new Conflict({ code: "CONFLICT" }))).toStrictEqual({
      exitCode: 1,
      json: '{"_tag":"Conflict","code":"CONFLICT"}',
    });
    expect(formatFailure(new Error("password=do-not-print"))).toStrictEqual({
      exitCode: 1,
      json: '{"_tag":"CliFailure","code":"CLI_TRANSPORT"}',
    });
    expect(formatFailure(new CliFailure("CLI_INPUT")).exitCode).toBe(2);
  });

  it("rejects non-origin targets and cleartext remote credential destinations", () => {
    expect(validateBaseUrl("http://127.0.0.1:3000/")).toBe(
      "http://127.0.0.1:3000"
    );
    expect(validateBaseUrl("https://zoen.example")).toBe(
      "https://zoen.example"
    );
    for (const value of [
      "http://zoen.example",
      "https://person:secret@zoen.example",
      "https://zoen.example/path",
      "https://zoen.example/?token=x",
      "file:///tmp/x",
    ]) {
      expect(() => validateBaseUrl(value)).toThrow(CliFailure);
    }
  });

  it.live(
    "preserves raw document text, rejects oversized bytes and insecure password files",
    () =>
      Effect.scoped(
        Effect.gen(function* inputFiles() {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const directory = yield* fs.makeTempDirectoryScoped({
            prefix: "zoen-cli-input-",
          });
          const file = path.join(directory, "document.json");
          const document = '\uFEFF\n{"duplicate":1,"duplicate":2,"text":"á"}\n';
          yield* fs.writeFileString(file, document, { mode: 0o600 });
          expect(yield* readInput(file, 1024)).toBe(document);
          expect(yield* readInput(file, 2).pipe(Effect.flip)).toMatchObject({
            code: "CLI_INPUT",
          });
          yield* fs.chmod(file, 0o644);
          expect(
            yield* readInput(file, 1024, true).pipe(Effect.flip)
          ).toMatchObject({ code: "CLI_INPUT" });
          const link = path.join(directory, "link");
          yield* fs.symlink(file, link);
          expect(yield* readInput(link, 1024).pipe(Effect.flip)).toMatchObject({
            code: "CLI_INPUT",
          });
        })
      ).pipe(Effect.provide(NodeServices.layer))
  );

  it.live(
    "binds private sessions to an origin, refuses overwrite, and removes only the session",
    () =>
      Effect.scoped(
        Effect.gen(function* sessionFiles() {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const directory = yield* fs.makeTempDirectoryScoped({
            prefix: "zoen-cli-session-",
          });
          const unrelated = path.join(directory, "keep.txt");
          yield* fs.writeFileString(unrelated, "preserve");
          const cookie = Redacted.make(
            "zoen-worlds.session_token=local-file-test"
          );
          yield* saveSession(directory, "http://localhost:3000", cookie);
          const storedStat = yield* fs.stat(
            path.join(directory, "session.json")
          );
          const storedCookie = yield* readSession(
            directory,
            "http://localhost:3000"
          );
          expect({
            cookie: Redacted.value(storedCookie),
            mode: storedStat.mode % 512,
          }).toStrictEqual({ cookie: Redacted.value(cookie), mode: 0o600 });
          expect(
            yield* readSession(directory, "http://localhost:3001").pipe(
              Effect.flip
            )
          ).toMatchObject({ code: "CLI_SESSION" });
          expect(
            yield* saveSession(directory, "http://localhost:3000", cookie).pipe(
              Effect.flip
            )
          ).toMatchObject({ code: "CLI_SESSION" });
          yield* removeSession(directory);
          expect(yield* fs.readFileString(unrelated)).toBe("preserve");
          expect(
            yield* readSession(directory, "http://localhost:3000").pipe(
              Effect.flip
            )
          ).toMatchObject({ code: "CLI_SESSION" });
        })
      ).pipe(Effect.provide(NodeServices.layer))
  );
});
