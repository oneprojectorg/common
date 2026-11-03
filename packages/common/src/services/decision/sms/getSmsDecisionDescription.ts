import { ProcessStatus } from '@op/db/schema';

import { NotFoundError } from '../../../utils';
import { countBallotProposals } from '../countBallotProposals';
import { getDecisionBySlug } from '../getDecisionBySlug';
import {
  type CurrentPhaseSummary,
  summarizeCurrentPhase,
} from '../summarizeCurrentPhase';

export interface SmsDecisionDescription extends CurrentPhaseSummary {
  name: string;
  slug: string;
  proposalCount: number;
}

export async function getSmsDecisionDescription({
  authUserId,
  decisionSlug,
}: {
  authUserId: string;
  decisionSlug: string;
}): Promise<SmsDecisionDescription> {
  const { name, slug, processInstance } = await getDecisionBySlug({
    user: { id: authUserId },
    slug: decisionSlug,
  });

  if (processInstance.status !== ProcessStatus.PUBLISHED) {
    throw new NotFoundError('Decision', decisionSlug);
  }

  const { id, instanceData, currentStateId } = processInstance;
  const proposalCount = await countBallotProposals({
    instance: { id, instanceData, currentStateId },
  });

  return {
    name,
    slug,
    proposalCount,
    ...summarizeCurrentPhase({ instanceData, currentStateId }),
  };
}
