import { describe, expect, it } from "@effect/vitest";
import { Effect, Logger, Schema } from "effect";

import { ServerConfigurationError } from "../src/configuration.ts";
import {
  logServerFailed,
  serverMainRuntimeOptions,
} from "../src/server-failed.ts";

const ServerFailedLog = Schema.Tuple([
  Schema.Struct({
    cause: Schema.String,
    event: Schema.Literal("server.failed"),
  }),
]);

describe("server.failed Cause logging", () => {
  it("keeps default Effect error reporting for Fly boot", () => {
    expect(serverMainRuntimeOptions.disableErrorReporting).toBeUndefined();
  });

  it.effect("logs serialized Cause on server.failed", () =>
    Effect.gen(function* assertServerFailedLogsCause() {
      const messages: unknown[] = [];
      const collector = Logger.make((options) => {
        messages.push(options.message);
      });

      yield* Effect.exit(
        Effect.die("fly-boot-defect").pipe(
          Effect.tapCause((cause) => logServerFailed(cause))
        )
      ).pipe(Effect.provide(Logger.layer([collector])));

      expect(messages).toHaveLength(1);
      const [message] = messages;
      const decoded =
        yield* Schema.decodeUnknownEffect(ServerFailedLog)(message);
      const [entry] = decoded;
      expect(entry.cause).toContain("fly-boot-defect");
      expect(entry.cause).toContain("Die");
    })
  );
});

describe("ServerConfigurationError Cause message", () => {
  it("exposes RELEASE_MISMATCH for Fly server.failed Cause logs", () => {
    const error = new ServerConfigurationError({ code: "RELEASE_MISMATCH" });
    expect(error.message).toBe("RELEASE_MISMATCH");
    expect(String(error)).toContain("RELEASE_MISMATCH");
  });
});
