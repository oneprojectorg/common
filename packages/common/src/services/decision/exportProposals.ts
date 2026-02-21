import { set } from '@op/cache';
import { ProposalFilter } from '@op/core';
import { db, eq } from '@op/db/client';
import {
  ProposalStatus,
  organizations,
  processInstances,
} from '@op/db/schema';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';
import { randomUUID } from 'crypto';

import { NotFoundError } from '../../utils';
import { getProfileAccessUser } from '../access';

export interface ExportProposalsInput {
  processInstanceId: string;
  format: 'csv';
  categoryId?: string;
  submittedByProfileId?: string;
  status?: ProposalStatus;
  dir: 'asc' | 'desc';
  proposalFilter?: ProposalFilter;
}

export const exportProposals = async ({
  input,
  user,
}: {
  input: ExportProposalsInput;
  user: User;
}): Promise<{ exportId: string; organizationId: string }> => {
  const { processInstanceId } = input;

  // Get process instance with profile and org info
  const result = await db
    .select({
      profileId: processInstances.profileId,
      organizationId: organizations.id,
    })
    .from(processInstances)
    .innerJoin(
      organizations,
      eq(organizations.profileId, processInstances.ownerProfileId),
    )
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!result[0]) {
    throw new NotFoundError('Process instance not found');
  }

  if (!result[0].profileId) {
    throw new NotFoundError('Decision profile not found');
  }

  // Check user permissions via profile
  const profileUser = await getProfileAccessUser({
    user,
    profileId: result[0].profileId,
  });

  assertAccess([{ decisions: permission.ADMIN }], profileUser?.roles ?? []);

  const exportId = randomUUID();

  // Set initial 'pending' status in cache so frontend can poll immediately
  const cacheKey = `export:proposal:${exportId}`;
  await set(
    cacheKey,
    {
      exportId,
      processInstanceId: input.processInstanceId,
      userId: user.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    2 * 60 * 60, // 2 hours
  );

  // Trigger workflow
  await event.send({
    name: Events.proposalExportRequested.name,
    data: {
      exportId,
      processInstanceId: input.processInstanceId,
      userId: user.id,
      format: input.format,
      filters: {
        categoryId: input.categoryId,
        submittedByProfileId: input.submittedByProfileId,
        status: input.status,
        dir: input.dir,
        proposalFilter: input.proposalFilter,
      },
    },
  });

  return {
    exportId,
    organizationId: result[0].organizationId,
  };
};
