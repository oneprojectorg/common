import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, ValidationError } from '../../utils';
import {
  assertInstanceProfileAccess,
  invalidateProfileUserAccessCache,
} from '../access';
import { assertProposalsAllowed } from './assertProposalsAllowed';
import { insertProposalDraft } from './insertProposalDraft';
import { decisionPermission } from './permissions';
import type { ProposalDataInput } from './proposalDataSchema';
import { resolveProposalDraftInputs } from './proposalDraftInputs';
import type { DecisionInstanceData } from './schemas/instanceData';
import { assertInstancePhase } from './utils/instance';

export interface CreateProposalInput {
  processInstanceId: string;
  proposalData: ProposalDataInput;
  attachmentIds?: string[];
}

export const createProposal = async ({
  data,
  user,
}: {
  data: CreateProposalInput;
  user: User;
}) => {
  const authUserId = user.id;

  // Verify the process instance exists
  const instance = await db.query.processInstances.findFirst({
    where: { id: data.processInstanceId },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', data.processInstanceId);
  }

  await assertInstanceProfileAccess({
    user: { id: authUserId },
    instance,
    profilePermissions: [
      { profile: permission.ADMIN },
      { decisions: decisionPermission.SUBMIT_PROPOSALS },
    ],
    orgFallbackPermissions: { profile: permission.ADMIN },
  });

  const instanceData = instance.instanceData as DecisionInstanceData;
  const currentPhaseId = instance.currentStateId;

  if (!currentPhaseId) {
    throw new ValidationError('Invalid phase in process instance');
  }

  assertProposalsAllowed({
    instance: { instanceData },
    phaseId: currentPhaseId,
  });

  const currentPhase = assertInstancePhase({
    instance: { instanceData },
    phaseId: currentPhaseId,
  });

  const draftInputs = await resolveProposalDraftInputs({
    authUserId,
    instanceProfileId: instance.profileId,
    phase: currentPhase,
    proposalData: data.proposalData,
  });

  const createdProposal = await db.transaction((tx) =>
    insertProposalDraft({
      tx,
      user,
      processInstanceId: data.processInstanceId,
      proposalData: data.proposalData,
      attachmentIds: data.attachmentIds,
      ...draftInputs,
    }),
  );

  // The author's cached `user` entry predates this membership.
  await invalidateProfileUserAccessCache({
    authUserId,
    profileId: createdProposal.profileId,
  });

  return createdProposal;
};
