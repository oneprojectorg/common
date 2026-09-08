import { db } from '@op/db/client';
import { logger } from '@op/logging';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import type { ThemeAnalysisData } from './schemas/themeAnalysis';
import { themeAnalysisRecordSchema } from './schemas/themeAnalysis';

// Re-exported here because this module is where callers already look for it.
// `schemas/themeAnalysis.ts` derives the type from the schema that validates the
// record, so the type and the check cannot drift.
export type { ThemeAnalysisData } from './schemas/themeAnalysis';

/**
 * Reads one theme analysis's status, and its result once the run has finished.
 *
 * Authorization runs in a fixed order. The row's own `requestedByAuthUserId`
 * settles ownership, then `assertInstanceProfileAccess` settles
 * `decisions: ADMIN` on the profile that owns the instance — the same boundary
 * `requestThemeAnalysis` applied on the way in, re-asserted here because a row
 * outlives the role that produced it.
 *
 * `result` is `jsonb`, so Postgres hands it back as whatever was written. It is
 * parsed against the record schema rather than asserted: nothing between the
 * write and this read checks its shape, and a row written by an older deploy is
 * a real possibility. A row that does not parse is reported as `not_found`,
 * which returns the client to idle rather than leaving it waiting on something
 * no later read will repair.
 *
 * @param analysisId - The analysis to read.
 * @param user - The calling user, checked for ownership and then for decision
 *   admin.
 * @returns The parsed record, or `{ status: 'not_found' }` when no usable row
 *   exists.
 * @throws UnauthorizedError when the caller does not own the analysis, or no
 *   longer holds `decisions: ADMIN` on the owning profile.
 * @throws NotFoundError when the row names a process instance that is gone.
 */
export const getThemeAnalysisStatus = async ({
  analysisId,
  user,
}: {
  analysisId: string;
  user: User;
}): Promise<ThemeAnalysisData | { status: 'not_found' }> => {
  const row = await db.query.proposalThemeAnalyses.findFirst({
    where: { id: analysisId },
    columns: {
      id: true,
      processInstanceId: true,
      requestedByAuthUserId: true,
      status: true,
      result: true,
      analyzedCount: true,
      total: true,
      errorCode: true,
      errorMessage: true,
      createdAt: true,
      completedAt: true,
    },
    with: {
      processInstance: { columns: { profileId: true } },
    },
  });

  if (!row) {
    return { status: 'not_found' as const };
  }

  if (row.requestedByAuthUserId !== user.id) {
    throw new UnauthorizedError('You do not have access to this analysis');
  }

  if (!row.processInstance) {
    throw new NotFoundError('Process instance', row.processInstanceId);
  }

  // `ownerProfileId` is null for the reason given in `requestThemeAnalysis`:
  // the analysis reads every proposal in the phase, so it stays with admins of
  // the decision profile rather than with org-level grant holders.
  await assertInstanceProfileAccess({
    user,
    instance: {
      profileId: row.processInstance.profileId,
      ownerProfileId: null,
    },
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  const parsed = themeAnalysisRecordSchema.safeParse({
    analysisId: row.id,
    processInstanceId: row.processInstanceId,
    userId: row.requestedByAuthUserId,
    status: row.status,
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
    errorCode: row.errorCode ?? undefined,
    errorMessage: row.errorMessage ?? undefined,
    result: row.result ?? undefined,
    analyzedCount: row.analyzedCount ?? undefined,
    total: row.total ?? undefined,
  });

  if (!parsed.success) {
    logger.error('Stored theme analysis does not match its schema', {
      analysisId,
      error: parsed.error,
    });

    return { status: 'not_found' as const };
  }

  return parsed.data;
};
