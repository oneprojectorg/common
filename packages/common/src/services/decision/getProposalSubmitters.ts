import { and, db, eq, inArray, isNull, ne } from '@op/db/client';
import { ProposalStatus, Visibility, proposals } from '@op/db/schema';
import { processInstances } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { getProposalIdsForPhase } from './getProposalsForPhase';

export interface GetProposalSubmittersInput {
  processInstanceId: string;
}

/**
 * Returns unique submitter profiles for non-draft, visible proposals
 * in the current phase of a decision instance. Designed to power the
 * participation face-pile without the overhead of a full listProposals call.
 */
export const getProposalSubmitters = async ({
  input,
  user,
}: {
  input: GetProposalSubmittersInput;
  user: User;
}) => {
  const { processInstanceId } = input;

  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  const instance = await db
    .select({
      profileId: processInstances.profileId,
      ownerProfileId: processInstances.ownerProfileId,
      instanceData: processInstances.instanceData,
      processId: processInstances.processId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!instance[0]?.profileId) {
    throw new UnauthorizedError('User does not have access to this process');
  }

  await assertInstanceProfileAccess({
    user,
    instance: instance[0],
    profilePermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
    orgFallbackPermissions: [
      { decisions: permission.ADMIN },
      { decisions: permission.READ },
    ],
  });

  const phaseProposalIds = await getProposalIdsForPhase({
    instanceId: processInstanceId,
  });

  if (phaseProposalIds.length === 0) {
    return { submitters: [] };
  }

  const rows = await db._query.proposals.findMany({
    where: and(
      eq(proposals.processInstanceId, processInstanceId),
      ne(proposals.status, ProposalStatus.DRAFT),
      eq(proposals.visibility, Visibility.VISIBLE),
      isNull(proposals.deletedAt),
      inArray(proposals.id, phaseProposalIds),
    ),
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
    const profile = Array.isArray(row.submittedBy)
      ? row.submittedBy[0]
      : row.submittedBy;
    if (profile) {
      submitters.push({
        slug: profile.slug,
        name: profile.name ?? null,
        avatarImage: profile.avatarImage
          ? { name: profile.avatarImage.name }
          : null,
      });
    }
  }

  return { submitters };
};
