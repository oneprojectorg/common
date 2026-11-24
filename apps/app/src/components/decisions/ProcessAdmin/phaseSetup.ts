import type { DecisionPhase, InstanceData } from '@op/api/encoders';
import { isReviewPhase } from '@op/common/client';

export type PhaseTemplates = Pick<
  InstanceData,
  'proposalTemplate' | 'rubricTemplate'
>;

export type SetupBlurbKey =
  | 'setupBlurbCollect'
  | 'setupBlurbReview'
  | 'setupBlurbDevelop'
  | 'setupBlurbVote'
  | 'setupBlurbResults';

/** A phase is ready once both its dates are set and, where it collects a form, the form has a field. */
export function isPhaseReady(
  phase: DecisionPhase,
  templates: PhaseTemplates,
): boolean {
  if (!phase.startDate || !phase.endDate) {
    return false;
  }

  if (isReviewPhase(phase)) {
    return hasFields(phase.rubricTemplate ?? templates.rubricTemplate);
  }

  if (phase.rules?.proposals?.submit || phase.rules?.proposals?.develop) {
    return hasFields(phase.proposalTemplate ?? templates.proposalTemplate);
  }

  return true;
}

export function getSetupBlurbKey(phase: DecisionPhase): SetupBlurbKey {
  if (isReviewPhase(phase)) {
    return 'setupBlurbReview';
  }
  if (phase.rules?.proposals?.submit) {
    return 'setupBlurbCollect';
  }
  if (phase.rules?.proposals?.develop) {
    return 'setupBlurbDevelop';
  }
  if (phase.rules?.voting?.submit) {
    return 'setupBlurbVote';
  }
  return 'setupBlurbResults';
}

function hasFields(
  template: { properties?: Record<string, unknown> } | null | undefined,
): boolean {
  return Object.keys(template?.properties ?? {}).length > 0;
}
