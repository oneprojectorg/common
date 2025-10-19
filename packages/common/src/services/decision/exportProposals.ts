import { randomUUID } from 'crypto';

import { db, eq } from '@op/db/client';
import { organizations, processInstances } from '@op/db/schema';
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

  return {
    exportId,
    organizationId: instanceOrg[0].id,
  };
};
