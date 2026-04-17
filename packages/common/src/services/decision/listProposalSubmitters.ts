import { db } from '@op/db/client';
import { ProposalStatus, Visibility } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { getProposalIdsForPhase } from './getProposalsForPhase';

export interface ListProposalSubmittersInput {
  processInstanceId: string;
}

/**
 * Returns unique submitter profiles for non-draft, visible proposals
 * in the current phase of a decision instance. Designed to power the
 * participation face-pile without the overhead of a full listProposals call.
 */
export const listProposalSubmitters = async ({
  input,
  user,
}: {
  input: ListProposalSubmittersInput;
  user: User;
}) => {
  const { processInstanceId } = input;

  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: {
      profileId: true,
      ownerProfileId: true,
      instanceData: true,
      processId: true,
    },
  });

  if (!instance?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  await assertInstanceProfileAccess({
    user,
    instance,
    profilePermissions: { decisions: permission.READ },
    orgFallbackPermissions: { decisions: permission.READ },
  });

  const phaseProposalIds = await getProposalIdsForPhase({
    instanceId: processInstanceId,
  });

  if (phaseProposalIds.length === 0) {
    return { submitters: [] };
  }

  const rows = await db.query.proposals.findMany({
    where: {
      processInstanceId,
      status: { ne: ProposalStatus.DRAFT },
      visibility: Visibility.VISIBLE,
      deletedAt: { isNull: true },
      id: { in: phaseProposalIds },
    },
    columns: {
      submittedByProfileId: true,
    },
    with: {
      submittedBy: {
        with: {
          avatarImage: true,
        },
      },
    },
  });

  const seen = new Set<string>();
  const submitters: Array<{
    slug: string;
    name: string | null;
    avatarImage: { name: string } | null;
  }> = [];

  for (const row of rows) {
    if (!row.submittedByProfileId || seen.has(row.submittedByProfileId)) {
      continue;
    }
    seen.add(row.submittedByProfileId);
    const profile = row.submittedBy;
    if (profile) {
      submitters.push({
        slug: profile.slug,
        name: profile.name ?? null,
        avatarImage: profile.avatarImage?.name
          ? { name: profile.avatarImage.name }
          : null,
      });
    }
  }

  return { submitters };
};
