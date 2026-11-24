import type { DecisionPhase, InstanceData } from '@op/api/encoders';
import {
  isDevelopPhase,
  isReviewPhase,
  isVotingPhase,
} from '@op/common/client';

export type PhaseTemplates = Pick<
  InstanceData,
  'proposalTemplate' | 'rubricTemplate'
>;

type SetupBlurbKey =
  | 'setupBlurbCollect'
  | 'setupBlurbReview'
  | 'setupBlurbDevelop'
  | 'setupBlurbVote'
  | 'setupBlurbResults';

/** A phase is ready once both its dates are set and every form it collects has a field. */
export function isPhaseReady(
  phase: DecisionPhase,
  templates: PhaseTemplates,
): boolean {
  if (!phase.startDate || !phase.endDate) {
    return false;
  }

  if (
    isReviewPhase(phase) &&
    !hasFields(phase.rubricTemplate ?? templates.rubricTemplate)
  ) {
    return false;
  }

  if (
    (isSubmitPhase(phase) || isDevelopPhase(phase)) &&
    !hasFields(phase.proposalTemplate ?? templates.proposalTemplate)
  ) {
    return false;
  }

  return true;
}

export function getSetupBlurbKey(phase: DecisionPhase): SetupBlurbKey {
  if (isReviewPhase(phase)) {
    return 'setupBlurbReview';
  }
  if (isSubmitPhase(phase)) {
    return 'setupBlurbCollect';
  }
  if (isDevelopPhase(phase)) {
    return 'setupBlurbDevelop';
  }
  if (isVotingPhase(phase)) {
    return 'setupBlurbVote';
  }
  return 'setupBlurbResults';
}

function isSubmitPhase(phase: DecisionPhase): boolean {
  return phase.rules?.proposals?.submit ?? false;
}

function hasFields(
  template: { properties?: Record<string, unknown> } | null | undefined,
): boolean {
  return Object.keys(template?.properties ?? {}).length > 0;
}
