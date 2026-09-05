import { NodeRuntime, NodeServices } from "@effect/platform-node";
import { Console, Effect, Layer, Result } from "effect";
import { CliError, CliOutput, Command } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import { d01Command } from "./d01/command.ts";
import { CliFailure, formatFailure } from "./d01/output.ts";

const program = Effect.gen(function* cliMain() {
  const terminal = yield* Console.Console;
  const formatter = yield* CliOutput.Formatter;
  const help: string[] = [];
  let renderedHelp: string | null = null;
  // Native CLI renders help before reporting a parse failure. Hold only that document;
  // normal command output and interactive prompts retain their normal timing.
  const cliConsole = new Proxy(terminal, {
    get: (target, key, receiver): unknown => {
      if (key !== "log") {
        return Reflect.get(target, key, receiver);
      }
      return (...args: readonly unknown[]) => {
        if (
          args.length === 1 &&
          args[0] === renderedHelp &&
          renderedHelp !== null
        ) {
          help.push(renderedHelp);
          renderedHelp = null;
          return;
        }
        terminal.log(...args);
      };
    },
  });
  const cliFormatter: CliOutput.Formatter = {
    formatCliError: formatter.formatCliError,
    formatError: formatter.formatError,
    formatErrors: formatter.formatErrors,
    formatHelpDoc: (document) => {
      renderedHelp = formatter.formatHelpDoc(document);
      return renderedHelp;
    },
    formatVersion: formatter.formatVersion,
  };
  const result = yield* Command.run(d01Command, {
    renderErrors: false,
    version: "0.0.0",
  }).pipe(
    Effect.provideService(Console.Console, cliConsole),
    Effect.provideService(CliOutput.Formatter, cliFormatter),
    Effect.result
  );
  if (Result.isFailure(result)) {
    const error = result.failure;
    if (
      !(
        CliError.isCliError(error) &&
        error._tag === "ShowHelp" &&
        error.errors.length === 0
      )
    ) {
      const failure = formatFailure(
        CliError.isCliError(error) ? new CliFailure("CLI_INPUT") : error
      );
      yield* Console.error(failure.json);
      yield* Effect.sync(() => {
        process.exitCode = failure.exitCode;
      });
      return;
    }
  }
  for (const document of help) {
    yield* Console.log(document);
  }
});

NodeRuntime.runMain(
  program.pipe(
    Effect.provide(Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer))
  ),
  { disableErrorReporting: true }
);
