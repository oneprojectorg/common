import { DecisionVoterEnrolmentStatus, ProcessStatus } from '@op/db/schema';

import { NotFoundError } from '../../../utils';
import { countBallotProposals } from '../countBallotProposals';
import { getDecisionBySlug } from '../getDecisionBySlug';
import {
  type CurrentPhaseSummary,
  summarizeCurrentPhase,
} from '../summarizeCurrentPhase';
import { findVoterEnrolment } from '../voterEnrolment';

export interface SmsDecisionDescription extends CurrentPhaseSummary {
  name: string;
  proposalCount: number;
}

export async function getSmsDecisionDescription({
  authUserId,
  decisionSlug,
}: {
  authUserId: string;
  decisionSlug: string;
}): Promise<SmsDecisionDescription> {
  const { name, processInstance } = await getDecisionBySlug({
    user: { id: authUserId },
    slug: decisionSlug,
  });

  if (processInstance.status !== ProcessStatus.PUBLISHED) {
    throw new NotFoundError('Decision', decisionSlug);
  }

  const { id, instanceData, currentStateId } = processInstance;
  const enrolment = await findVoterEnrolment({
    processInstanceId: id,
    authUserId,
  });
  const proposalCount = await countBallotProposals({
    instance: { id, instanceData, currentStateId },
    boundaryId:
      enrolment?.status === DecisionVoterEnrolmentStatus.ENROLLED
        ? enrolment.boundaryId
        : null,
  });

  return {
    name,
    proposalCount,
    ...summarizeCurrentPhase({ instanceData, currentStateId }),
  };
}
