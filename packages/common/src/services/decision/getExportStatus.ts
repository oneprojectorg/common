import { db, eq } from '@op/db/client';
import { ProposalExportStatus, proposalExports } from '@op/db/schema';
import type { Logger } from '@op/logging';
import { User } from '@op/supabase/lib';
import { createSBServerClient } from '@op/supabase/server';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';
import {
  EXPORTS_BUCKET,
  EXPORT_URL_TTL_SECONDS,
  exportFilePath,
  nextUrlExpiresAt,
} from './exports';

/** Subset of `@op/logging`'s `Logger` this module needs; also satisfied
 * structurally by the tRPC context logger, which callers pass in. */
type ExportLogger = Pick<Logger, 'info' | 'warn'>;

export interface ExportStatusData {
  exportId: string;
  processInstanceId: string;
  // Nullable: the requester's auth account can be deleted after the export
  // was created (`requestedByUserId` is `ON DELETE SET NULL`), which must not
  // make an otherwise-complete, durable export permanently unrecoverable.
  userId: string | null;
  format: string;
  status: ProposalExportStatus;
  fileName?: string;
  signedUrl?: string;
  urlExpiresAt?: string;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

/**
 * Signed URLs are shorter-lived than the export record, so a completed export
 * is re-signed on read once its current URL has lapsed. Mutates `exportStatus`
 * in place when a fresh URL is minted.
 */
const refreshExpiredSignedUrl = async (
  exportStatus: ExportStatusData,
  logger: ExportLogger,
): Promise<void> => {
  if (
    exportStatus.status !== ProposalExportStatus.COMPLETED ||
    !exportStatus.fileName ||
    !exportStatus.urlExpiresAt
  ) {
    return;
  }

  if (new Date(exportStatus.urlExpiresAt) >= new Date()) {
    return;
  }

  logger.info('Refreshing expired signed URL', {
    exportId: exportStatus.exportId,
  });

  const filePath = exportFilePath(
    exportStatus.processInstanceId,
    exportStatus.fileName,
  );

  const supabase = await createSBServerClient();
  const { data: urlData, error: urlError } = await supabase.storage
    .from(EXPORTS_BUCKET)
    .createSignedUrl(filePath, EXPORT_URL_TTL_SECONDS);

  if (urlError || !urlData) {
    // Nothing else surfaces this: the download link stays dead until the next
    // read tries again, so an operator looking into a stuck export needs this
    // in the logs rather than silently repeating the same failed re-sign.
    logger.warn('Failed to refresh expired signed URL', {
      exportId: exportStatus.exportId,
      error: urlError,
    });

    return;
  }

  const urlExpiresAt = nextUrlExpiresAt();

  exportStatus.signedUrl = urlData.signedUrl;
  exportStatus.urlExpiresAt = urlExpiresAt.toISOString();

  await db
    .update(proposalExports)
    .set({ signedUrl: urlData.signedUrl, urlExpiresAt })
    .where(eq(proposalExports.id, exportStatus.exportId));
};

export const getExportStatus = async ({
  exportId,
  user,
  logger,
}: {
  exportId: string;
  user: User;
  logger: ExportLogger;
}): Promise<ExportStatusData | { status: 'not_found' }> => {
  // Get export data from its durable record, joined to the process instance's
  // profile in one query — the relation the access check needs.
  const row = await db.query.proposalExports.findFirst({
    where: { id: exportId },
    with: { processInstance: { columns: { profileId: true } } },
  });

  if (!row) {
    return { status: 'not_found' as const };
  }

  const { requestedByUserId } = row;

  // Reject a caller who isn't the requester — but only when a requester is
  // still on record. `requestedByUserId` is `ON DELETE SET NULL`, so once the
  // requesting account is deleted this column can no longer attribute the
  // export to anyone; falling through to the profile check below (rather
  // than hard-rejecting on a null column, which nobody could ever satisfy)
  // is what keeps an otherwise-complete export from becoming permanently
  // unrecoverable by any admin.
  if (requestedByUserId && requestedByUserId !== user.id) {
    throw new UnauthorizedError('You do not have access to this export');
  }

  // Additionally verify user still has access to the decision profile
  if (!row.processInstance) {
    throw new NotFoundError('Process instance', row.processInstanceId);
  }

  if (!row.processInstance.profileId) {
    throw new NotFoundError('Decision profile', row.processInstanceId);
  }

  // Verify user has admin permission on the profile
  await assertProfileAccess({
    user,
    profileId: row.processInstance.profileId,
    permissions: [{ decisions: permission.ADMIN }],
  });

  const exportStatus: ExportStatusData = {
    exportId: row.id,
    processInstanceId: row.processInstanceId,
    userId: requestedByUserId,
    format: row.format,
    status: row.status,
    fileName: row.fileName ?? undefined,
    signedUrl: row.signedUrl ?? undefined,
    urlExpiresAt: row.urlExpiresAt?.toISOString(),
    errorMessage: row.errorMessage ?? undefined,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
  };

  await refreshExpiredSignedUrl(exportStatus, logger);

  return exportStatus;
};
