import type { DecisionPhase } from '@op/api/encoders';
import {
  isDevelopPhase,
  isReviewPhase,
  isSubmitPhase,
  isVotingPhase,
} from '@op/common/client';

export type AdminPhaseKind =
  | 'Collect'
  | 'Review'
  | 'Develop'
  | 'Vote'
  | 'Results';

export function getAdminPhaseKind(phase: DecisionPhase): AdminPhaseKind {
  if (isReviewPhase(phase)) {
    return 'Review';
  }
  if (isSubmitPhase(phase)) {
    return 'Collect';
  }
  if (isDevelopPhase(phase)) {
    return 'Develop';
  }
  if (isVotingPhase(phase)) {
    return 'Vote';
  }
  return 'Results';
}
