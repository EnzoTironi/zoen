import type { ActionType, SubmissionCriteriaStub } from "@zoen/oms/schemas";

import { SubmissionCriteriaRejectedError } from "./errors.js";

/** Actor facts supplied by the host for submission-criteria placeholders. */
export interface ActionActor {
  readonly authenticated: boolean;
  readonly isOwner: boolean;
  readonly principalId: string | null;
  readonly worldScope: boolean;
}

/** True when no affirmative submission criteria are declared (pass-through). */
export const isEmptySubmissionCriteria = (
  criteria: SubmissionCriteriaStub
): boolean =>
  !criteria.requireAuthenticated &&
  !criteria.requireOwner &&
  !criteria.requireWorldScope;

/**
 * Evaluate OMS submission-criteria placeholders.
 * Empty criteria → pass-through. Declared + unmet → fail closed.
 * Golden rule: no LLM grant path; host-supplied actor facts only.
 */
export const evaluateSubmissionCriteria = (
  actionType: ActionType,
  actor: ActionActor
): void => {
  const criteria = actionType.submissionCriteria;
  if (isEmptySubmissionCriteria(criteria)) {
    return;
  }
  if (criteria.requireAuthenticated && !actor.authenticated) {
    throw new SubmissionCriteriaRejectedError({
      actionTypeId: actionType.id,
      criterion: "requireAuthenticated",
    });
  }
  if (criteria.requireWorldScope && !actor.worldScope) {
    throw new SubmissionCriteriaRejectedError({
      actionTypeId: actionType.id,
      criterion: "requireWorldScope",
    });
  }
  if (criteria.requireOwner && !actor.isOwner) {
    throw new SubmissionCriteriaRejectedError({
      actionTypeId: actionType.id,
      criterion: "requireOwner",
    });
  }
};
