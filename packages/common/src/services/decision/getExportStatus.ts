import { db, eq } from '@op/db/client';
import { organizations, processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

export interface ExportStatusData {
  exportId: string;
  processInstanceId: string;
  userId: string;
  format: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  filters: any;
  fileName?: string;
  signedUrl?: string;
  urlExpiresAt?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

export const getExportStatus = async ({
  exportData,
  user,
}: {
  exportData: ExportStatusData | null;
  user: User;
}): Promise<void> => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  // If export not found, no need to check permissions
  if (!exportData) {
    return;
  }

  // Verify user owns this export (basic ownership check)
  if (exportData.userId !== user.id) {
    throw new UnauthorizedError('You do not have access to this export');
  }

  // Additionally verify user still has admin access to the organization
  const instanceOrg = await db
    .select({
      id: organizations.id,
    })
    .from(organizations)
    .leftJoin(
      processInstances,
      eq(organizations.profileId, processInstances.ownerProfileId),
    )
    .where(eq(processInstances.id, exportData.processInstanceId))
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

  // Verify user still has admin permission
  assertAccess({ decisions: permission.ADMIN }, orgUser.roles || []);
};
