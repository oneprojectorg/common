import { ProcessStatus } from '@op/db/schema';

import { NotFoundError } from '../../utils';
import { countBallotProposals } from './countBallotProposals';
import { getDecisionBySlug } from './getDecisionBySlug';
import {
  type CurrentPhaseSummary,
  summarizeCurrentPhase,
} from './summarizeCurrentPhase';

export interface SmsDecisionDescription extends CurrentPhaseSummary {
  name: string;
  proposalCount: number;
}

export async function describeSmsDecision({
  authUserId,
  slug,
}: {
  authUserId: string;
  slug: string;
}): Promise<SmsDecisionDescription> {
  const { name, processInstance } = await getDecisionBySlug({
    user: { id: authUserId },
    slug,
  });

  if (processInstance.status !== ProcessStatus.PUBLISHED) {
    throw new NotFoundError('Decision', slug);
  }

  const { id, instanceData, currentStateId } = processInstance;
  const proposalCount = await countBallotProposals({
    instance: { id, instanceData, currentStateId },
  });

  return {
    name,
    proposalCount,
    ...summarizeCurrentPhase({ instanceData, currentStateId }),
  };
}
