import { set } from '@op/cache';
import { ProposalFilter } from '@op/core';
import { db, eq } from '@op/db/client';
import { ProposalStatus, organizations, processInstances } from '@op/db/schema';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { randomUUID } from 'crypto';

import { NotFoundError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { EXPORT_CACHE_TTL_SECONDS, exportStatusCacheKey } from './exports';

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
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!result[0].profileId) {
    throw new NotFoundError('Decision profile', processInstanceId);
  }

  // Check user permissions via profile
  await assertProfileAccess({
    user,
    profileId: result[0].profileId,
    permissions: [{ decisions: permission.ADMIN }],
  });

  const exportId = randomUUID();

  // Set initial 'pending' status in cache so frontend can poll immediately
  await set(
    exportStatusCacheKey(exportId),
    {
      exportId,
      processInstanceId: input.processInstanceId,
      userId: user.id,
      status: 'pending',
      createdAt: new Date().toISOString(),
    },
    EXPORT_CACHE_TTL_SECONDS,
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
