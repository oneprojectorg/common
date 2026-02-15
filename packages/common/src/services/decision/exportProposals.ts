import { set } from '@op/cache';
import { ProposalFilter } from '@op/core';
import { and, db, eq } from '@op/db/client';
import {
  ProposalStatus,
  organizationUsers,
  organizations,
  processInstances,
} from '@op/db/schema';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';
import { randomUUID } from 'crypto';

import { UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

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

  // Get organization AND verify user membership
  const result = await db
    .select({
      organizationId: organizations.id,
      orgUserId: organizationUsers.id,
    })
    .from(processInstances)
    .innerJoin(
      organizations,
      eq(organizations.profileId, processInstances.ownerProfileId),
    )
    .innerJoin(
      organizationUsers,
      and(
        eq(organizationUsers.organizationId, organizations.id),
        eq(organizationUsers.authUserId, user.id),
      ),
    )
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!result[0]) {
    throw new UnauthorizedError(
      'Process instance not found or you are not a member of this organization',
    );
  }

  // Get full org user with roles for permission check (cached)
  const orgUser = await getOrgAccessUser({
    user,
    organizationId: result[0].organizationId,
  });

  // This should always succeed since we validated membership above
  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  assertAccess({ decisions: permission.ADMIN }, orgUser.roles || []);

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
