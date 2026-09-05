import { QuestionAnswer } from "@zoen/contracts/d01/operations";
import {
  ClaimRef,
  CorrectionRef,
  Digest,
  FrameRef,
  LocalDate,
  QuestionRef,
  SubjectKey,
} from "@zoen/contracts/d01/values";
import type { OperationId, Realm, WorldId } from "@zoen/contracts/d01/values";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { CliFailure } from "../../d01/output.js";

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
  schemaVersion: "d01.v1",
} as const;

/** These commands only assemble public requests; the server owns scope, consent and undo. */
export const makeCorrectionCommands = <E, R>(
  shared: SharedFlags,
  send: (request: unknown) => Effect.Effect<void, E, R>,
  report: Reporter
) =>
  [
    Command.make(
      "propose-correction",
      {
        ...shared,
        choice: Flag.choice("choice", ["select-claim", "unknown"]).pipe(
          Flag.withDescription(
            "Explicit interval decision to propose; no reusable rule is created"
          )
        ),
        claimRef: Flag.string("claim-ref").pipe(
          Flag.withSchema(ClaimRef),
          Flag.optional,
          Flag.withDescription(
            "Required only for --choice select-claim; must occur in the supplied Frame"
          )
        ),
        frameRef: Flag.string("frame-ref").pipe(Flag.withSchema(FrameRef)),
        subjectKey: Flag.string("subject-key").pipe(
          Flag.withSchema(SubjectKey)
        ),
        validFrom: Flag.string("valid-from").pipe(
          Flag.withSchema(LocalDate),
          Flag.withDescription("Inclusive civil date YYYY-MM-DD")
        ),
        validTo: Flag.string("valid-to").pipe(
          Flag.withSchema(LocalDate),
          Flag.withDescription("Exclusive civil date YYYY-MM-DD")
        ),
      },
      (flags) =>
        report(
          Effect.gen(function* proposeFromExplicitFrame() {
            if (
              (flags.choice === "select-claim") !==
              Option.isSome(flags.claimRef)
            ) {
              return yield* new CliFailure("CLI_INPUT");
            }
            const choice = Option.isSome(flags.claimRef)
              ? { _tag: "selectClaim", claimRef: flags.claimRef.value }
              : { _tag: "unknown" };
            return yield* send({
              ...envelope,
              input: {
                consequence: {
                  choice,
                  subjectKey: flags.subjectKey,
                  validTime: {
                    _tag: "DateInterval",
                    from: flags.validFrom,
                    to: flags.validTo,
                  },
                },
                frameRef: flags.frameRef,
              },
              operation: "ProposeCorrection",
              operationId: flags.operationId,
              worldRef: { realm: flags.realm, worldId: flags.worldId },
            });
          })
        )
    ).pipe(
      Command.withDescription(
        "Propose a decision for one obligation and interval; print its Question and exact consequence digest"
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 propose-correction --world-id <uuid> --operation-id <uuid> --frame-ref <uuid> --subject-key obligation-1 --valid-from 2026-09-01 --valid-to 2026-10-01 --choice select-claim --claim-ref <uuid>",
          description:
            "Propose a claim from the retained Frame for September only; keep operation-id on retry",
        },
        {
          command:
            "zoen --base-url http://localhost:3000 propose-correction --world-id <uuid> --operation-id <uuid> --frame-ref <uuid> --subject-key obligation-1 --valid-from 2026-09-01 --valid-to 2026-10-01 --choice unknown",
          description:
            "Propose explicit unknown for the interval without selecting a source",
        },
      ])
    ),
    Command.make(
      "answer-question",
      {
        ...shared,
        answer: Flag.choice("answer", QuestionAnswer.literals).pipe(
          Flag.withDescription(
            "confirm applies the proposed choice; unknown does not select a source"
          )
        ),
        consequenceDigest: Flag.string("consequence-digest").pipe(
          Flag.withSchema(Digest),
          Flag.withDescription(
            "Exact digest returned with the Question; never recomputed by this client"
          )
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
            operation: "AnswerQuestion",
            operationId: flags.operationId,
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Answer the exact retained Question; stale consent is rejected by the server"
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 answer-question --world-id <uuid> --operation-id <uuid> --question-ref <uuid> --consequence-digest <sha256> --answer confirm",
          description:
            "Apply exactly the displayed proposal; preserve operation-id and digest on retry",
        },
        {
          command:
            "zoen --base-url http://localhost:3000 answer-question --world-id <uuid> --operation-id <uuid> --question-ref <uuid> --consequence-digest <sha256> --answer unknown",
          description:
            "Record unknown for the proposal's exact obligation and interval",
        },
      ])
    ),
    Command.make(
      "undo-correction",
      {
        ...shared,
        correctionRef: Flag.string("correction-ref").pipe(
          Flag.withSchema(CorrectionRef),
          Flag.withDescription(
            "Effective correction reference from a fresh Inspect"
          )
        ),
        frameRef: Flag.string("frame-ref").pipe(Flag.withSchema(FrameRef)),
      },
      (flags) =>
        report(
          send({
            ...envelope,
            input: {
              correctionRef: flags.correctionRef,
              frameRef: flags.frameRef,
            },
            operation: "UndoCorrection",
            operationId: flags.operationId,
            worldRef: { realm: flags.realm, worldId: flags.worldId },
          })
        )
    ).pipe(
      Command.withDescription(
        "Append an undo event for the effective scoped decision; retain previous receipts and Frames"
      ),
      Command.withExamples([
        {
          command:
            "zoen --base-url http://localhost:3000 undo-correction --world-id <uuid> --operation-id <uuid> --frame-ref <uuid> --correction-ref <uuid>",
          description:
            "Use the current Frame and effective correction; reuse operation-id on retry",
        },
      ])
    ),
  ] as const;
