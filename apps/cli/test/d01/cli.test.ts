/* eslint-disable effecttsgo/node-builtin-import, effecttsgo/async-function -- These tests exercise real POSIX file permissions and descriptors, without a fake filesystem. */
import {
  chmod,
  mkdtemp,
  readFile,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Conflict } from "@zoen/contracts/d01/errors";
import { WorldCreated } from "@zoen/contracts/d01/operations";
import { Effect, Redacted, Schema } from "effect";
import { describe, expect, it } from "vitest";

import { readInput, validateBaseUrl } from "../../src/d01/input.js";
import {
  CliFailure,
  formatFailure,
  formatSuccess,
} from "../../src/d01/output.js";
import {
  readSession,
  removeSession,
  saveSession,
} from "../../src/d01/session.js";

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

  it("preserves raw document text, rejects oversized bytes and insecure password files", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "zoen-cli-input-"));
    const file = path.join(directory, "document.json");
    const document = '\uFEFF\n{"duplicate":1,"duplicate":2,"text":"á"}\n';
    await writeFile(file, document, { mode: 0o600 });
    await expect(Effect.runPromise(readInput(file, 1024))).resolves.toBe(
      document
    );
    await expect(Effect.runPromise(readInput(file, 2))).rejects.toMatchObject({
      code: "CLI_INPUT",
    });
    await chmod(file, 0o644);
    await expect(
      Effect.runPromise(readInput(file, 1024, true))
    ).rejects.toMatchObject({ code: "CLI_INPUT" });
    const link = path.join(directory, "link");
    await symlink(file, link);
    await expect(
      Effect.runPromise(readInput(link, 1024))
    ).rejects.toMatchObject({ code: "CLI_INPUT" });
  });

  it("binds private sessions to an origin, refuses overwrite, and removes only the session", async () => {
    const directory = await mkdtemp(
      path.join(os.tmpdir(), "zoen-cli-session-")
    );
    const unrelated = path.join(directory, "keep.txt");
    await writeFile(unrelated, "preserve");
    const cookie = Redacted.make("zoen-d01.session_token=local-file-test");
    await Effect.runPromise(
      saveSession(directory, "http://localhost:3000", cookie)
    );
    const storedStat = await stat(path.join(directory, "session.json"));
    const storedCookie = await Effect.runPromise(
      readSession(directory, "http://localhost:3000")
    );
    expect({
      cookie: Redacted.value(storedCookie),
      mode: storedStat.mode % 512,
    }).toStrictEqual({ cookie: Redacted.value(cookie), mode: 0o600 });
    await expect(
      Effect.runPromise(readSession(directory, "http://localhost:3001"))
    ).rejects.toMatchObject({ code: "CLI_SESSION" });
    await expect(
      Effect.runPromise(saveSession(directory, "http://localhost:3000", cookie))
    ).rejects.toMatchObject({ code: "CLI_SESSION" });
    await Effect.runPromise(removeSession(directory));
    await expect(readFile(unrelated, "utf-8")).resolves.toBe("preserve");
    await expect(
      Effect.runPromise(readSession(directory, "http://localhost:3000"))
    ).rejects.toMatchObject({ code: "CLI_SESSION" });
  });
});
