import { IdentityAnswer } from "@zoen/contracts/subject-identity/values";
import {
  Digest,
  FrameRef,
  LocalDate,
  QuestionRef,
  SubjectKey,
} from "@zoen/contracts/worlds/values";
import type {
  OperationId,
  Realm,
  WorldId,
} from "@zoen/contracts/worlds/values";
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
  schemaVersion: "subject-identity.v1",
} as const;

const validFrom = Flag.string("valid-from").pipe(
  Flag.withSchema(LocalDate),
  Flag.withDescription("Inclusive civil date YYYY-MM-DD")
);
const validTo = Flag.string("valid-to").pipe(
  Flag.withSchema(LocalDate),
  Flag.withDescription("Exclusive civil date YYYY-MM-DD")
);
const atFrame = Flag.string("at-frame").pipe(
  Flag.withSchema(FrameRef),
  Flag.optional,
  Flag.withDescription("Optional retained Frame reference")
);
const frameRef = Flag.string("frame-ref").pipe(Flag.withSchema(FrameRef));
const frameKind = Flag.choice("frame-kind", [
  "subject-identity",
  "subject-identity-recovery",
]).pipe(
  Flag.withDefault("subject-identity"),
  Flag.withDescription("Frame kind returned by the preceding inspect")
);

/** Public request assembly only; authorization and graph mutation stay on the server. */
export const makeSubjectIdentityCommands = <E, R>(
  shared: SharedFlags,
  send: (request: unknown) => Effect.Effect<void, E, R>,
  report: Reporter
) =>
  [
    Command.make(
      "inspect-identity",
      {
        anchors: Flag.string("anchors").pipe(
          Flag.withDescription(
            "Comma-separated subject keys (1 or 2) to seed the private graph"
          )
        ),
        atFrame,
        realm: shared.realm,
        validFrom,
        validTo,
        worldId: shared.worldId,
      },
      (flags) =>
        report(
          Effect.gen(function* inspectIdentity() {
            const anchors = flags.anchors
              .split(",")
              .map((value) => value.trim())
              .filter((value) => value.length > 0);
            if (anchors.length < 1 || anchors.length > 2) {
              return yield* new CliFailure("CLI_INPUT");
            }
            return yield* send({
              ...envelope,
              input: {
                anchors,
                atFrame: Option.getOrNull(flags.atFrame),
                interval: {
                  _tag: "DateInterval",
                  from: flags.validFrom,
                  to: flags.validTo,
                },
              },
              operation: "InspectSubjectIdentity",
              worldRef: { realm: flags.realm, worldId: flags.worldId },
            });
          })
        )
    ).pipe(
      Command.withDescription(
        "Inspect the private subject-identity graph for the supplied anchors and interval. Prints closure, cells and comparisons; no mutation."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 inspect-identity --world-id <uuid> --anchors A,B --valid-from 2026-09-01 --valid-to 2026-10-01",
          description:
            "Read the current private identity Frame for two anchors",
        },
      ])
    ),
    Command.make(
      "inspect-identity-recovery",
      {
        anchor: Flag.string("anchor").pipe(Flag.withSchema(SubjectKey)),
        atFrame,
        realm: shared.realm,
        targetDecisionRef: Flag.string("target-decision-ref").pipe(
          Flag.optional,
          Flag.withDescription(
            "Optional decision to center recovery/undo inspection"
          )
        ),
        validFrom,
        validTo,
        worldId: shared.worldId,
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: {
              anchor: flags.anchor,
              atFrame: Option.getOrNull(flags.atFrame),
              interval: {
                _tag: "DateInterval",
                from: flags.validFrom,
                to: flags.validTo,
              },
              targetDecisionRef: Option.getOrNull(flags.targetDecisionRef),
            },
            operation: "InspectIdentityRecovery",
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Inspect structural recovery only. comparison is not-requested; no value comparisons. Use before split/undo when claims exceed comparative quota."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 inspect-identity-recovery --world-id <uuid> --anchor A --valid-from 2026-09-01 --valid-to 2026-10-01 --target-decision-ref <uuid>",
          description:
            "Read a recovery Frame centered on an identity decision before proposing undo",
        },
      ])
    ),
    Command.make(
      "propose-same-as",
      {
        ...shared,
        frameRef,
        left: Flag.string("left").pipe(Flag.withSchema(SubjectKey)),
        right: Flag.string("right").pipe(Flag.withSchema(SubjectKey)),
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: {
              frame: { frameRef: flags.frameRef, kind: "subject-identity" },
              left: flags.left,
              right: flags.right,
            },
            operation: "ProposeIdentityResolution",
            operationId: flags.operationId,
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Propose same-as/different-from for two anchors against an inspected identity Frame. Reuse --operation-id on transport retry; Stale requires a new inspect and a new operation."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 propose-same-as --world-id <uuid> --frame-ref <uuid> --left A --right B --operation-id <uuid>",
          description:
            "Freeze a Question for A/B; keep every argument unchanged when retrying Unavailable",
        },
      ])
    ),
    Command.make(
      "propose-identity-split",
      {
        ...shared,
        anchor: Flag.string("anchor").pipe(Flag.withSchema(SubjectKey)),
        frameKind,
        frameRef,
        partitionsJson: Flag.string("partitions-json").pipe(
          Flag.withDescription(
            "JSON array of {cellRef, blocks: string[][]} covering each cell"
          )
        ),
      },
      (flags) =>
        report(
          Effect.gen(function* proposeSplit() {
            const partitions = yield* Schema.decodeEffect(
              Schema.fromJsonString(Schema.Unknown)
            )(flags.partitionsJson).pipe(
              Effect.mapError(() => new CliFailure("CLI_INPUT"))
            );
            return yield* send({
              ...envelope,
              input: {
                anchor: flags.anchor,
                frame: { frameRef: flags.frameRef, kind: flags.frameKind },
                partitionsByCell: partitions,
              },
              operation: "ProposeIdentitySplit",
              operationId: flags.operationId,
              worldRef: { realm: flags.realm, worldId: flags.worldId },
            });
          })
        )
    ).pipe(
      Command.withDescription(
        "Propose a full structural split against an inspected Frame. Confirmation applies the entire partition; Stale needs a fresh inspect and new operation-id."
      ),
      Command.withExamples([
        {
          command:
            'zoen --base-url http://localhost:3000 propose-identity-split --world-id <uuid> --frame-ref <uuid> --anchor A --partitions-json \'[{"cellRef":"<digest>","blocks":[["A"],["B"]]}]\' --operation-id <uuid>',
          description: "Propose separating A from B in every cell",
        },
      ])
    ),
    Command.make(
      "propose-identity-undo",
      {
        ...shared,
        frameKind,
        frameRef,
        targetDecisionRef: Flag.string("target-decision-ref"),
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: {
              frame: { frameRef: flags.frameRef, kind: flags.frameKind },
              targetDecisionRef: flags.targetDecisionRef,
            },
            operation: "ProposeIdentityUndo",
            operationId: flags.operationId,
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Propose undoing one identity decision using a comparative or recovery Frame. Recovery Questions declare comparison not-requested."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 propose-identity-undo --world-id <uuid> --frame-ref <uuid> --frame-kind subject-identity-recovery --target-decision-ref <uuid> --operation-id <uuid>",
          description:
            "Propose structural undo after inspect-identity-recovery",
        },
      ])
    ),
    Command.make(
      "resolve-identity",
      {
        ...shared,
        answer: Flag.choice("answer", IdentityAnswer.literals).pipe(
          Flag.withDescription(
            "same-as | different-from | confirm | unknown from the Question"
          )
        ),
        consequenceDigest: Flag.string("consequence-digest").pipe(
          Flag.withSchema(Digest)
        ),
        questionRef: Flag.string("question-ref").pipe(
          Flag.withSchema(QuestionRef)
        ),
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: {
              answer: flags.answer,
              consequenceDigest: flags.consequenceDigest,
              questionRef: flags.questionRef,
            },
            operation: "ResolveIdentity",
            operationId: flags.operationId,
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Confirm or abandon a proposed identity Question. Reuse operation-id/digest on Unavailable retry. Stale requires a new inspect and explicit new confirmation."
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 resolve-identity --world-id <uuid> --question-ref <uuid> --consequence-digest <digest> --answer same-as --operation-id <uuid>",
          description: "Apply a same-as alternative from propose-same-as",
        },
      ])
    ),
  ] as const;
