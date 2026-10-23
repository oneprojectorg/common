import { db } from '@op/db/client';
import { DecisionVoterEnrolmentStatus } from '@op/db/schema';
import { permission } from 'access-zones';

import {
  NotFoundError,
  ValidationError,
  VoterNotEnrolledError,
} from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { ensureBallotDraft, setBallotPageCursor } from '../ballotDraft';
import { countBallotProposals } from '../countBallotProposals';
import {
  type BallotProposalInfo,
  getBallotProposalByCode,
} from '../getBallotProposalByCode';
import {
  type BallotProposalListItem,
  listBallotProposals,
} from '../listBallotProposals';
import { getInstancePhases } from '../schemas/instanceData';
import { getInstanceCurrentPhase } from '../utils/instance';
import { getVoterEnrolment, isVotingPhase } from '../utils/phaseSettings';
import { findVoterEnrolment } from '../voterEnrolment';

export const SMS_BALLOT_PAGE_SIZE = 5;

export interface SmsBallotPage {
  decisionName: string;
  district: string | null;
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
  const [instance, enrolment] = await Promise.all([
    db.query.processInstances.findFirst({
      where: { id: instanceId },
      columns: {
        id: true,
        profileId: true,
        instanceData: true,
        currentStateId: true,
        processId: true,
      },
      with: { profile: { columns: { name: true } } },
    }),
    findVoterEnrolment({ processInstanceId: instanceId, authUserId }),
  ]);

  if (!instance?.profile || !instance.profileId) {
    throw new NotFoundError('Process instance', instanceId);
  }

  await assertProfileAccess({
    user: { id: authUserId },
    profileId: instance.profileId,
    permissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
    notMemberMessage: 'User does not have access to this process',
  });

  const phase = getInstanceCurrentPhase({
    currentStateId: instance.currentStateId,
    instanceData: { phases: getInstancePhases(instance.instanceData) },
  });

  if (!phase || !isVotingPhase(phase)) {
    throw new ValidationError('Voting is not open for this decision');
  }

  if (
    getVoterEnrolment(phase) &&
    enrolment?.status !== DecisionVoterEnrolmentStatus.ENROLLED
  ) {
    throw new VoterNotEnrolledError();
  }

  const boundaryId =
    enrolment?.status === DecisionVoterEnrolmentStatus.ENROLLED
      ? enrolment.boundaryId
      : null;
  const boundary = boundaryId
    ? await db.query.decisionBoundaries.findFirst({
        where: { id: boundaryId },
        columns: { name: true },
      })
    : null;

  return {
    instance,
    decisionName: instance.profile.name,
    boundaryId,
    district: boundary?.name ?? null,
  };
};

export async function listSmsBallotPage({
  authUserId,
  instanceId,
  after,
}: {
  authUserId: string;
  instanceId: string;
  after?: number;
}): Promise<SmsBallotPage> {
  const { instance, decisionName, boundaryId, district } =
    await loadBallotScope({ authUserId, instanceId });
  const [total, page] = await Promise.all([
    countBallotProposals({ instance, boundaryId }),
    listBallotProposals({
      instance,
      boundaryId,
      after,
      limit: SMS_BALLOT_PAGE_SIZE,
    }),
  ]);
  const key = { processInstanceId: instanceId, authUserId };
  await ensureBallotDraft(key);
  await setBallotPageCursor({ ...key, pageCursor: page.nextCursor });

  return {
    decisionName,
    district,
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
  const { instance, boundaryId } = await loadBallotScope({
    authUserId,
    instanceId,
  });
  return getBallotProposalByCode({ instance, boundaryId, code });
}
