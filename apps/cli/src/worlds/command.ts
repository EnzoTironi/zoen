import { homedir } from "node:os";

import { decodeSemanticRequest } from "@zoen/contracts/worlds/operations";
import {
  D01_LIMITS,
  EvidenceRef,
  FrameRef,
  OperationId,
  SubjectKey,
  WorldId,
} from "@zoen/contracts/worlds/values";
import { Console, Effect, Option, Path, Redacted } from "effect";
import { Command, Flag } from "effect/unstable/cli";
import { FetchHttpClient } from "effect/unstable/http";

import { makeErasureCommands } from "../erasure/command.js";
import { makeEveCommands } from "../eve/command.js";
import { makeCorrectionCommands } from "../integration/corrections/command.js";
import { makeSharingCommands } from "../sharing/command.js";
import { makeSubjectIdentityCommands } from "../subject-identity/command.js";
import { readInput, validateBaseUrl } from "./input.js";
import { CliFailure, formatFailure, formatSuccess } from "./output.js";
import { readSession, removeSession, saveSession } from "./session.js";
import { authenticate, execute, signOut } from "./transport.js";

const root = Command.make("zoen").pipe(
  Command.withSharedFlags({
    baseUrl: Flag.string("base-url").pipe(
      Flag.withDescription("Server origin; HTTPS or loopback HTTP")
    ),
    sessionDir: Flag.string("session-dir").pipe(
      Flag.optional,
      Flag.withDescription(
        "Private 0700 directory containing the 0600 session file"
      )
    ),
  })
);

const settings = Effect.gen(function* settings() {
  const flags = yield* root;
  const baseUrl = yield* Effect.try({
    catch: () => new CliFailure("CLI_INPUT"),
    try: () => validateBaseUrl(flags.baseUrl),
  });
  const path = yield* Path.Path;
  const sessionDir = Option.getOrElse(flags.sessionDir, () =>
    path.join(homedir(), ".config", "zoen")
  );
  return { baseUrl, sessionDir };
});

const report = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "error" }),
    Effect.timeout("35 seconds"),
    Effect.matchEffect({
      onFailure: (error) => {
        const failure = formatFailure(error);
        return Console.error(failure.json).pipe(
          Effect.andThen(
            Effect.sync(() => {
              process.exitCode = failure.exitCode;
            })
          )
        );
      },
      onSuccess: Effect.succeed,
    })
  );

const envelope = {
  purpose: "personal-records",
  schemaVersion: "worlds.v1",
} as const;
const operationId = Flag.string("operation-id").pipe(
  Flag.withSchema(OperationId),
  Flag.withDescription("Stable UUID; reuse the same value for retries")
);
const worldId = Flag.string("world-id").pipe(Flag.withSchema(WorldId));
const realm = Flag.choice("realm", ["live", "evaluation"]).pipe(
  Flag.withDefault("live")
);

const send = Effect.fn(function* send(request: unknown) {
  const config = yield* settings;
  const payload = yield* decodeSemanticRequest(request).pipe(
    Effect.mapError(() => new CliFailure("CLI_INPUT"))
  );
  const cookie = yield* readSession(config.sessionDir, config.baseUrl);
  const result = yield* execute(config.baseUrl, cookie, payload);
  yield* Console.log(formatSuccess(result));
});

const createWorld = Command.make("create-world", { operationId }, (flags) =>
  report(
    send({
      ...envelope,
      input: {},
      operation: "CreatePersonalWorld",
      operationId: flags.operationId,
    })
  )
).pipe(
  Command.withDescription(
    "Create a private World using a caller-supplied retry identity"
  ),
  Command.withExamples([
    {
      command:
        "zoen --base-url http://localhost:3000 create-world --operation-id <uuid>",
      description: "Create a World; reuse this operation UUID when retrying",
    },
  ])
);
const importEvidence = Command.make(
  "import",
  {
    file: Flag.string("file").pipe(
      Flag.withDefault("-"),
      Flag.withDescription(
        "Raw document file, or - for stdin; bytes are not parsed or normalized"
      )
    ),
    format: Flag.choice("format", ["json", "csv"]).pipe(
      Flag.withDefault("json"),
      Flag.withDescription(
        "Document format: json (legacy worlds JSON) or csv (Zoen worlds.csv.v1 dialect)"
      )
    ),
    operationId,
    realm,
    worldId,
  },
  (flags) =>
    report(
      Effect.gen(function* importDocument() {
        const document = yield* readInput(flags.file, D01_LIMITS.documentBytes);
        yield* send({
          ...envelope,
          input:
            flags.format === "csv"
              ? { document, format: "worlds.csv.v1" }
              : { document },
          operation: "ImportEvidence",
          operationId: flags.operationId,
          worldRef: { realm: flags.realm, worldId: flags.worldId },
        });
      })
    )
).pipe(
  Command.withDescription(
    "Import authorized evidence through the public executor"
  ),
  Command.withExamples([
    {
      command:
        "zoen --base-url http://127.0.0.1:4310 import --world-id <uuid> --operation-id <uuid> --file document.json",
      description: "Send the original document using a stable operation UUID",
    },
    {
      command:
        "zoen --base-url http://127.0.0.1:4310 import --world-id <uuid> --operation-id <uuid> --format csv --file document.csv",
      description: "Import the Zoen CSV dialect with its explicit selector",
    },
    {
      command:
        "cat document.csv | zoen --base-url http://127.0.0.1:4310 import --world-id <uuid> --operation-id <uuid> --format csv --file -",
      description: "Read the same original UTF-8 document from stdin",
    },
  ])
);
const inspect = Command.make(
  "inspect",
  {
    atFrame: Flag.string("at-frame").pipe(
      Flag.withSchema(FrameRef),
      Flag.optional
    ),
    realm,
    subjectKey: Flag.string("subject-key").pipe(Flag.withSchema(SubjectKey)),
    worldId,
  },
  (flags) =>
    report(
      send({
        ...envelope,
        input: {
          atFrame: Option.getOrNull(flags.atFrame),
          subjectKey: flags.subjectKey,
        },
        operation: "Inspect",
        worldRef: { realm: flags.realm, worldId: flags.worldId },
      })
    )
).pipe(
  Command.withDescription(
    "Inspect a subject at a recorded frame or the current frame"
  ),
  Command.withExamples([
    {
      command:
        "zoen --base-url http://localhost:3000 inspect --world-id <uuid> --subject-key obligation-1",
      description: "Print the current authorized frame as JSON",
    },
  ])
);
const openEvidence = Command.make(
  "open",
  {
    evidenceRef: Flag.string("evidence-ref").pipe(Flag.withSchema(EvidenceRef)),
    realm,
    worldId,
  },
  (flags) =>
    report(
      send({
        ...envelope,
        input: { evidenceRef: flags.evidenceRef },
        operation: "OpenEvidence",
        worldRef: { realm: flags.realm, worldId: flags.worldId },
      })
    )
).pipe(
  Command.withDescription("Read authorized evidence through the server"),
  Command.withExamples([
    {
      command:
        "zoen --base-url http://localhost:3000 open --world-id <uuid> --evidence-ref <uuid>",
      description: "Read the original evidence through the server",
    },
  ])
);

const authCommand = (action: "sign-up" | "sign-in") =>
  Command.make(
    action,
    {
      email: Flag.string("email"),
      name: Flag.string("name").pipe(Flag.withDefault("")),
      passwordFile: Flag.string("password-file").pipe(
        Flag.withDefault("-"),
        Flag.withDescription(
          "Password from stdin or an owned 0600 file; one trailing newline is removed"
        )
      ),
    },
    (flags) =>
      report(
        Effect.gen(function* authenticateCommand() {
          const config = yield* settings;
          const raw = yield* readInput(flags.passwordFile, 4096, true);
          const password = Redacted.make(raw.replace(/\r?\n$/u, ""));
          const cookie = yield* authenticate(
            config.baseUrl,
            action,
            flags.email,
            password,
            flags.name
          );
          yield* saveSession(config.sessionDir, config.baseUrl, cookie);
          yield* Console.log('{"_tag":"SignedIn"}');
        })
      )
  ).pipe(
    Command.withDescription(
      "Authenticate with the server and store its session cookie privately"
    ),
    Command.withExamples([
      {
        command: `zoen --base-url http://localhost:3000 ${action} --email person@example.com --password-file /private/password${action === "sign-up" ? ' --name "Personal account"' : ""}`,
        description: "Authenticate using a regular, owned 0600 password file",
      },
    ])
  );

const logout = Command.make("sign-out", {}, () =>
  report(
    Effect.gen(function* revokeSession() {
      const config = yield* settings;
      const cookie = yield* readSession(config.sessionDir, config.baseUrl);
      yield* signOut(config.baseUrl, cookie);
      yield* removeSession(config.sessionDir);
      yield* Console.log('{"_tag":"SignedOut"}');
    })
  )
).pipe(
  Command.withDescription(
    "Revoke the server session, then remove the local session file"
  ),
  Command.withExamples([
    {
      command: "zoen --base-url http://localhost:3000 sign-out",
      description: "Revoke the active session and remove its local credential",
    },
  ])
);

export const d01Command = root.pipe(
  Command.withDescription(
    "Zoen public API client. Results are JSON; errors go to stderr with nonzero exit status."
  ),
  Command.withSubcommands([
    authCommand("sign-up"),
    authCommand("sign-in"),
    logout,
    createWorld,
    importEvidence,
    inspect,
    openEvidence,
    ...makeCorrectionCommands({ operationId, realm, worldId }, send, report),
    ...makeSharingCommands({ operationId, realm, worldId }, send, report),
    ...makeSubjectIdentityCommands(
      { operationId, realm, worldId },
      send,
      report
    ),
    ...makeErasureCommands({ operationId, realm, worldId }, send, report),
    ...makeEveCommands({ operationId, realm, worldId }, send, report),
  ]),
  Command.withExamples([
    {
      command:
        "zoen --base-url http://localhost:3000 sign-in --email person@example.com --password-file /private/password",
      description: "Sign in using a private credential file",
    },
    {
      command:
        "zoen --base-url http://localhost:3000 import --world-id <uuid> --operation-id <uuid> --file document.json",
      description:
        "Import unchanged document text; preserve operation-id when retrying",
    },
    {
      command:
        "zoen --base-url http://localhost:3000 inspect --world-id <uuid> --subject-key obligation-1",
      description: "Print the server's current frame as JSON",
    },
  ])
);
