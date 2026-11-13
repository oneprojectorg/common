import { db } from '@op/db/client';
import { ProcessStatus } from '@op/db/schema';
import { permission } from 'access-zones';

import {
  NotFoundError,
  ValidationError,
  VoterNotEnrolledError,
} from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { ensureChatSession } from '../chatSession';
import { countBallotProposals } from '../countBallotProposals';
import {
  type BallotProposalInfo,
  getBallotProposalByCode,
} from '../getBallotProposalByCode';
import { resolvePhases } from '../instancePhases';
import {
  type BallotProposalListItem,
  listBallotProposals,
} from '../listBallotProposals';
import { getInstanceCurrentPhase } from '../utils/instance';
import { getVoterEnrolment, isVotingPhase } from '../utils/phaseSettings';
import { findVoterEnrolment, isVoterEnrolled } from '../voterEnrolment';

export const SMS_BALLOT_PAGE_SIZE = 5;

export interface SmsBallotPage {
  decisionName: string;
  termLabel: string | null;
  total: number;
  items: BallotProposalListItem[];
  nextCursor: number | null;
}

export const loadBallotScope = async ({
  authUserId,
  instanceId,
}: {
  authUserId: string;
  instanceId: string;
}) => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: {
      id: true,
      profileId: true,
      instanceData: true,
      currentStateId: true,
      processId: true,
      status: true,
    },
    with: { profile: { columns: { name: true } } },
  });

  if (
    !instance?.profile ||
    !instance.profileId ||
    instance.status !== ProcessStatus.PUBLISHED
  ) {
    throw new NotFoundError('Process instance', instanceId);
  }

  const [enrolment, resolved] = await Promise.all([
    findVoterEnrolment({ processInstanceId: instanceId, authUserId }),
    resolvePhases({ instance }),
    assertProfileAccess({
      user: { id: authUserId },
      profileId: instance.profileId,
      permissions: [
        { decisions: permission.ADMIN },
        { decisions: permission.READ },
      ],
      notMemberMessage: 'User does not have access to this process',
    }),
  ]);

  const phase = getInstanceCurrentPhase(resolved);

  if (!phase || !isVotingPhase(phase)) {
    throw new ValidationError('Voting is not open for this decision');
  }

  const rule = getVoterEnrolment(phase);

  if (rule && !isVoterEnrolled(enrolment)) {
    throw new VoterNotEnrolledError();
  }

  const taxonomyTermId = isVoterEnrolled(enrolment)
    ? (enrolment?.taxonomyTermId ?? null)
    : null;
  const term = taxonomyTermId
    ? await db.query.taxonomyTerms.findFirst({
        where: { id: taxonomyTermId },
        columns: { label: true },
      })
    : null;

  return {
    instance: resolved,
    decisionName: instance.profile.name,
    taxonomyTermId,
    termLabel: term?.label ?? null,
  };
};

export async function listSmsBallotPage({
  authUserId,
  instanceId,
  after,
  phoneNumberId,
}: {
  authUserId: string;
  instanceId: string;
  after?: number;
  phoneNumberId?: string | null;
}): Promise<SmsBallotPage> {
  const { instance, decisionName, taxonomyTermId, termLabel } =
    await loadBallotScope({ authUserId, instanceId });
  const [total, page] = await Promise.all([
    countBallotProposals({ instance, taxonomyTermId }),
    listBallotProposals({
      instance,
      taxonomyTermId,
      after,
      limit: SMS_BALLOT_PAGE_SIZE,
    }),
  ]);
  await ensureChatSession({
    processInstanceId: instanceId,
    authUserId,
    phoneNumberId,
  });

  return {
    decisionName,
    termLabel,
    total,
    items: page.items,
    nextCursor: page.nextCursor,
  };
}

export async function getSmsBallotProposal({
  authUserId,
  instanceId,
  code,
}: {
  authUserId: string;
  instanceId: string;
  code: number;
}): Promise<BallotProposalInfo | null> {
  const { instance, taxonomyTermId } = await loadBallotScope({
    authUserId,
    instanceId,
  });
  return getBallotProposalByCode({ instance, taxonomyTermId, code });
}
