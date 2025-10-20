import { randomUUID } from 'crypto';

import { set } from '@op/cache';
import { db, eq } from '@op/db/client';
import { organizations, processInstances } from '@op/db/schema';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

export interface ExportProposalsInput {
  processInstanceId: string;
  format: 'csv';
  categoryId?: string;
  submittedByProfileId?: string;
  status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  dir: 'asc' | 'desc';
  proposalFilter?: 'all' | 'my' | 'shortlisted' | 'my-ballot';
}

export const exportProposals = async ({
  input,
  user,
}: {
  input: ExportProposalsInput;
  user: User;
}): Promise<{ exportId: string; organizationId: string }> => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  const { processInstanceId } = input;

  // Get organization from process instance
  const instanceOrg = await db
    .select({
      id: organizations.id,
    })
    .from(organizations)
    .leftJoin(
      processInstances,
      eq(organizations.profileId, processInstances.ownerProfileId),
    )
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!instanceOrg[0]) {
    throw new UnauthorizedError('Process instance not found');
  }

  // Get user's organization membership and roles
  const orgUser = await getOrgAccessUser({
    user,
    organizationId: instanceOrg[0].id,
  });

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  // Require ADMIN permission to export proposals
  assertAccess({ decisions: permission.ADMIN }, orgUser.roles || []);

  // Generate export ID
  const exportId = randomUUID();

  // Set initial 'pending' status in cache so frontend can poll immediately
  const cacheKey = `export:proposal:${exportId}`;
  await set(
    cacheKey,
    {
      exportId,
      processInstanceId: input.processInstanceId,
      userId: user.id,
      format: input.format,
      status: 'pending',
      filters: {
        categoryId: input.categoryId,
        submittedByProfileId: input.submittedByProfileId,
        status: input.status,
        dir: input.dir,
        proposalFilter: input.proposalFilter,
      },
      createdAt: new Date().toISOString(),
    },
    24 * 60 * 60, // 24 hours TTL
  );

  // Send Inngest event to trigger export workflow
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
    organizationId: instanceOrg[0].id,
  };
};
