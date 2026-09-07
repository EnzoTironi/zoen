import { OperationId, Revision } from "@zoen/contracts/worlds/values";
import type { Realm, WorldId } from "@zoen/contracts/worlds/values";
import { Effect, Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { CliFailure } from "../worlds/output.js";

interface SharedFlags {
  readonly operationId: Flag.Flag<typeof OperationId.Type>;
  readonly realm: Flag.Flag<typeof Realm.Type>;
  readonly worldId: Flag.Flag<typeof WorldId.Type>;
}
type Reporter = <E, R>(
  self: Effect.Effect<void, E, R>
) => Effect.Effect<void, never, R>;

const envelope = {
  purpose: "personal-records",
  schemaVersion: "erasure.v1",
} as const;

const expectedErasureRevision = Flag.string("expected-revision").pipe(
  Flag.withSchema(Schema.Union([Revision, Schema.Literal("null")])),
  Flag.map((value) => (value === "null" ? null : value)),
  Flag.withDescription(
    "Revision from inspect-world-erasure; explicit null means Active with no progress row yet"
  )
);

const policyVersion = Flag.choice("policy-version", [
  "d03-local-erasable-v1",
]).pipe(
  Flag.withDefault("d03-local-erasable-v1"),
  Flag.withDescription(
    "Candidate erasable profile id; retained Worlds stay blocked"
  )
);

const confirmEntireWorld = Flag.boolean("confirm-entire-world").pipe(
  Flag.withDescription(
    "Required explicit confirmation that erasure covers the entire World (Frames, Questions, grants, imports, staged objects)"
  )
);

const inspectOperationId = Flag.string("operation-id").pipe(
  Flag.withSchema(OperationId),
  Flag.optional,
  Flag.withDescription(
    "Optional Closing operation UUID to narrow administrative inspect"
  )
);

/** Public request assembly only; authorization and Closing stay on the server. */
export const makeErasureCommands = <E, R>(
  shared: SharedFlags,
  send: (request: unknown) => Effect.Effect<void, E, R>,
  report: Reporter
) =>
  [
    Command.make(
      "inspect-world-erasure",
      {
        operationId: inspectOperationId,
        realm: shared.realm,
        worldId: shared.worldId,
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: { operationId: Option.getOrNull(flags.operationId) },
            operation: "InspectWorldErasure",
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Owner: read narrow administrative erasure progress for this World. Not content disclosure. Unavailable/Unknown stay honest; restore-after-erasure remains false. Viewers are denied."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 inspect-world-erasure --world-id <uuid>",
          description:
            "Read current phase, revision and attempt register state before confirming Closing",
        },
      ])
    ),
    Command.make(
      "request-world-erasure",
      {
        ...shared,
        confirmEntireWorld,
        expectedRevision: expectedErasureRevision,
        policyVersion,
      },
      (flags) =>
        report(
          Effect.gen(function* requestErasure() {
            if (!flags.confirmEntireWorld) {
              return yield* new CliFailure("CLI_INPUT");
            }
            return yield* send({
              ...envelope,
              input: {
                confirmEntireWorld: true,
                expectedErasureRevision: flags.expectedRevision,
                policyVersion: flags.policyVersion,
              },
              operation: "RequestWorldErasure",
              operationId: flags.operationId,
              worldRef: { realm: flags.realm, worldId: flags.worldId },
            });
          })
        )
    ).pipe(
      Command.withDescription(
        "Owner: request World-scoped Closing after inspect. Requires --confirm-entire-world. Reuse --operation-id on Unavailable retry; Stale requires a new inspect and a newly confirmed operation-id. Does not claim Erased or restore."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 request-world-erasure --world-id <uuid> --expected-revision null --confirm-entire-world --operation-id <uuid>",
          description:
            "Confirm entire-World Closing after inspect. Keep every argument unchanged when retrying Unavailable",
        },
        {
          command:
            "zoen --base-url http://localhost:3000 inspect-world-erasure --world-id <uuid>",
          description:
            "Re-inspect after Stale before confirming a new operation; do not reuse the previous confirmation",
        },
      ])
    ),
    Command.make(
      "purge-world-content",
      {
        ...shared,
        closingOperationId: Flag.string("closing-operation-id").pipe(
          Flag.withSchema(OperationId),
          Flag.withDescription(
            "Closing operation UUID from request-world-erasure / inspect"
          )
        ),
        expectedRevision: Flag.string("expected-revision").pipe(
          Flag.withSchema(Revision),
          Flag.withDescription(
            "Erasure revision from inspect while phase is Closing/Purging"
          )
        ),
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: {
              closingOperationId: flags.closingOperationId,
              expectedErasureRevision: flags.expectedRevision,
            },
            operation: "PurgeWorldContent",
            operationId: flags.operationId,
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Owner: purge local controlled SQL content + World object versions after Closing+Confirmada. Attests local-controlled-copies only; restore-after-erasure stays false. Does not claim backups/controller/Fly."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 purge-world-content --world-id <uuid> --closing-operation-id <uuid> --expected-revision 1 --operation-id <uuid>",
          description:
            "Advance Closing→Erased for disposable local copies after inspect shows Closing+Confirmed",
        },
      ])
    ),
  ] as const;
