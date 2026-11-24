import type { DecisionPhase, InstanceData } from '@op/api/encoders';
import {
  isDevelopPhase,
  isReviewPhase,
  isSubmitPhase,
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
