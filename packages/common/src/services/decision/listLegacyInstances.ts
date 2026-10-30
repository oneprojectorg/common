import { db, desc, eq } from '@op/db/client';
import { ProposalStatus, organizations, processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertOrgAccess } from '../assert';
import {
  type RedactableInstanceData,
  redactHiddenBudget,
} from './templateBudget';

export const listLegacyInstances = async ({
  ownerProfileId,
  user,
}: {
  ownerProfileId: string;
  user: User;
}) => {
  const org = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.profileId, ownerProfileId));

  if (!org[0]?.id) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const orgUser = await assertOrgAccess({
    user,
    organizationId: org[0].id,
    permissions: { decisions: permission.READ },
  });
  const isAdmin = checkPermission(
    { decisions: permission.ADMIN },
    orgUser.roles,
  );

  const instanceList = await db._query.processInstances.findMany({
    where: eq(processInstances.ownerProfileId, ownerProfileId),
    with: {
      process: true,
      owner: {
        with: {
          avatarImage: true,
        },
      },
      proposals: {
        columns: {
          id: true,
          status: true,
          submittedByProfileId: true,
        },
      },
    },
    orderBy: desc(processInstances.createdAt),
  });

  return instanceList.map((instance) => {
    const nonDraftProposals =
      instance.proposals?.filter(
        (proposal) => proposal.status !== ProposalStatus.DRAFT,
      ) || [];
    const proposalCount = nonDraftProposals.length;
    const uniqueParticipants = new Set(
      nonDraftProposals.map((proposal) => proposal.submittedByProfileId),
    );
    const participantCount = uniqueParticipants.size;

    return {
      ...instance,
      instanceData: isAdmin
        ? instance.instanceData
        : redactHiddenBudget(instance.instanceData as RedactableInstanceData),
      proposalCount,
      participantCount,
    };
  });
};
