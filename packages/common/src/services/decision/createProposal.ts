import { db } from '@op/db/client';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, ValidationError } from '../../utils';
import {
  assertInstanceProfileAccess,
  getCurrentProfileId,
  invalidateProfileUserAccessCache,
} from '../access';
import { assertGlobalRole } from '../assert';
import { assertProposalsAllowed } from './assertProposalsAllowed';
import { withBoundaryCategoryLabel } from './boundaryCategory';
import { insertProposalDraft } from './insertProposalDraft';
import { decisionPermission } from './permissions';
import {
  type ProposalDataInput,
  parseProposalData,
} from './proposalDataSchema';
import {
  extractTitleFromProposalData,
  getCategoryTermIds,
} from './proposalDraftInputs';
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

  // Capture the phase's `defaults.hidden` rule at creation time. The flag
  // sticks with the proposal through submission, so a draft authored under
  // a hidden-by-default phase remains hidden even if the rule is edited
  // before submit.
  const currentPhase = assertInstancePhase({
    instance: { instanceData },
    phaseId: currentPhaseId,
  });
  const defaultHidden =
    currentPhase.rules?.proposals?.defaults?.hidden === true;

  const parsedProposalData = parseProposalData(data.proposalData);

  // Extract title from proposal data
  const proposalTitle = extractTitleFromProposalData(data.proposalData);

  // Pre-fetch category terms if specified to avoid lookup inside transaction.
  // Include the location's council-district category (if any) so it is linked
  // through the normal category pipeline — no separate boundary-tagging pass.
  // Without a decision profile (legacy instances) the boundary lookup is
  // skipped and only the manual categories pass through.
  const manualCategoryLabels = [...new Set(parsedProposalData.category)];
  const categoryLabels = instance.profileId
    ? await withBoundaryCategoryLabel(manualCategoryLabels, data.proposalData, {
        profileId: instance.profileId,
      })
    : manualCategoryLabels;
  const categoryTermIds = await getCategoryTermIds(categoryLabels);

  const [profileId, adminRole] = await Promise.all([
    getCurrentProfileId(authUserId),
    assertGlobalRole('Admin'),
  ]);
  const createdProposal = await db.transaction((tx) =>
    insertProposalDraft({
      tx,
      user,
      processInstanceId: data.processInstanceId,
      proposalData: data.proposalData,
      attachmentIds: data.attachmentIds,
      proposalTitle,
      categoryLabels,
      categoryTermIds,
      submittedByProfileId: profileId,
      adminRoleId: adminRole.id,
      defaultHidden,
    }),
  );

  // The author's cached `user` entry predates this membership.
  await invalidateProfileUserAccessCache({
    authUserId,
    profileId: createdProposal.profileId,
  });

  return createdProposal;
};
