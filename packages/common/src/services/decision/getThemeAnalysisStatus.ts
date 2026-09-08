import { getWithStatus } from '@op/cache';
import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { logger } from '@op/logging';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import type {
  ThemeAnalysisData,
  ThemeAnalysisScope,
} from './schemas/themeAnalysis';
import { themeAnalysisRecordSchema } from './schemas/themeAnalysis';
import { themeAnalysisCacheKey } from './themes';

// Re-exported here because this module is where callers already look for it.
// `schemas/themeAnalysis.ts` derives the type from the schema that validates the
// record, so the type and the check cannot drift.
export type { ThemeAnalysisData } from './schemas/themeAnalysis';

/**
 * Reads one theme analysis's status, and its result once the run has finished.
 *
 * The instance and the scope are arguments rather than fields on the record
 * because they are part of the key — a run is stored under
 * `themeAnalysis:<instance>:<scope>:<id>`, so an id alone does not name it. The
 * caller has both: it chose the scope when it started the run.
 *
 * Authorization runs in a fixed order. The record's own `userId` settles
 * ownership, then `assertInstanceProfileAccess` settles `decisions: ADMIN` on
 * the profile that owns the instance — the same boundary `requestThemeAnalysis`
 * applied on the way in, re-asserted here because a record outlives the role
 * that produced it by up to a day.
 *
 * The cache holds the only copy, so this reads with {@link getWithStatus} and
 * keeps "the cache held nothing" apart from "the cache did not answer", and
 * parses what it gets rather than asserting a type.
 *
 * @param analysisId - The run to read.
 * @param processInstanceId - The instance it covers. Part of the key.
 * @param scope - The set it covers. Part of the key.
 * @param user - The calling user, checked for ownership and then for decision
 *   admin.
 * @returns The parsed record, or `{ status: 'not_found' }` when the cache holds
 *   no usable record.
 * @throws CommonError when the cache did not answer. Reporting that as
 *   `not_found` would make the client retire a run that is still going.
 * @throws UnauthorizedError when the caller does not own the analysis, or no
 *   longer holds `decisions: ADMIN` on the owning profile.
 * @throws NotFoundError when the record names a process instance that is gone.
 */
export const getThemeAnalysisStatus = async ({
  analysisId,
  processInstanceId,
  scope,
  user,
}: {
  analysisId: string;
  processInstanceId: string;
  scope: ThemeAnalysisScope;
  user: User;
}): Promise<ThemeAnalysisData | { status: 'not_found' }> => {
  const cached = await getWithStatus(
    themeAnalysisCacheKey({ processInstanceId, scope, analysisId }),
  );

  // Keep "no such analysis" apart from "the cache did not answer". The client
  // retires the analysis id when it reads `not_found`, so collapsing the two
  // would let one Redis timeout discard a run that is still working.
  if (cached.status === 'timeout' || cached.status === 'error') {
    throw new CommonError('Could not read the analysis.');
  }

  if (cached.status !== 'hit') {
    return { status: 'not_found' as const };
  }

  // Parse rather than assert. The cache holds the only copy, so nothing else
  // checks the shape this path depends on, and a malformed record is reachable:
  // the workflow patches by merging over the copy it reads, so an eviction
  // between the seed and a patch leaves a record holding a status and nothing
  // else. Such a record describes no analysis and no later read repairs it, so
  // this reports `not_found` and the client returns to idle.
  const parsed = themeAnalysisRecordSchema.safeParse(cached.data);

  if (!parsed.success) {
    logger.error('Stored theme analysis does not match its schema', {
      analysisId,
      error: parsed.error,
    });

    return { status: 'not_found' as const };
  }

  const analysis = parsed.data;

  if (analysis.userId !== user.id) {
    throw new UnauthorizedError('You do not have access to this analysis');
  }

  const [instance] = await db
    .select({ profileId: processInstances.profileId })
    .from(processInstances)
    .where(eq(processInstances.id, analysis.processInstanceId))
    .limit(1);

  if (!instance) {
    throw new NotFoundError('Process instance', analysis.processInstanceId);
  }

  // `ownerProfileId` is null for the reason given in `requestThemeAnalysis`:
  // the analysis reads every proposal in scope, so it stays with admins of the
  // decision profile rather than with org-level grant holders.
  await assertInstanceProfileAccess({
    user,
    instance: { profileId: instance.profileId, ownerProfileId: null },
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  return analysis;
};
