import { Data } from "effect";

/** Submission criteria declared and unmet — fail closed. */
export class SubmissionCriteriaRejectedError extends Data.TaggedError(
  "SubmissionCriteriaRejectedError"
)<{
  readonly actionTypeId: string;
  readonly criterion:
    | "requireAuthenticated"
    | "requireOwner"
    | "requireWorldScope";
}> {}
