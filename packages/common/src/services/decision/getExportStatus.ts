import { get, set } from '@op/cache';
import { db, eq } from '@op/db/client';
import { organizations, processInstances } from '@op/db/schema';
import { User } from '@op/supabase/lib';
import { createSBServerClient } from '@op/supabase/server';
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
  exportId,
  user,
  logger,
}: {
  exportId: string;
  user: User;
  logger: { info: (message: string, meta?: any) => void };
}): Promise<ExportStatusData | { status: 'not_found' }> => {
  if (!user) {
    throw new UnauthorizedError('User must be authenticated');
  }

  // Get export data from cache
  const key = `export:proposal:${exportId}`;
  const exportStatus = (await get(key)) as ExportStatusData | null;

  if (!exportStatus) {
    return { status: 'not_found' as const };
  }

  // Verify user owns this export (basic ownership check)
  if (exportStatus.userId !== user.id) {
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
    .where(eq(processInstances.id, exportStatus.processInstanceId))
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

  // Refresh signed URL if expired but file exists
  if (
    exportStatus.status === 'completed' &&
    exportStatus.signedUrl &&
    exportStatus.urlExpiresAt
  ) {
    const expiresAt = new Date(exportStatus.urlExpiresAt);

    if (expiresAt < new Date()) {
      logger.info('Refreshing expired signed URL', {
        exportId,
      });

      // Extract file path from the export status
      // We need to reconstruct it from the filename
      const filePath = `exports/proposals/${exportStatus.processInstanceId}/${exportStatus.fileName}`;

      const supabase = await createSBServerClient();
      const { data: urlData, error: urlError } = await supabase.storage
        .from('assets')
        .createSignedUrl(filePath, 60 * 60 * 24); // 24 hours

      if (!urlError && urlData) {
        exportStatus.signedUrl = urlData.signedUrl;
        exportStatus.urlExpiresAt = new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString();

        // Update cache with new signed URL (24 hours TTL)
        await set(key, exportStatus, 24 * 60 * 60);
      }
    }
  }

  return exportStatus;
};
