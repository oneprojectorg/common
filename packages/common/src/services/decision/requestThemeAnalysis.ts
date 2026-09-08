import { getWithStatus, set } from '@op/cache';
import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { randomUUID } from 'crypto';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import type { ThemeAnalysisScope } from './schemas/themeAnalysis';
import {
  THEME_ANALYSIS_CACHE_TTL_SECONDS,
  THEME_ANALYSIS_MIN_PROPOSALS,
  readProposalsInScope,
  themeAnalysisCacheKey,
} from './themes';

export interface RequestThemeAnalysisInput {
  processInstanceId: string;
  /**
   * Which proposals to analyse. The surface that launched the run decides — see
   * {@link ThemeAnalysisScope}. Defaulted to the phase, which is what every
   * caller before the results screen meant.
   */
  scope?: ThemeAnalysisScope;
}

/**
 * Starts a theme analysis over an instance's current phase and returns its id.
 *
 * The work happens in the `analyzeProposalThemes` workflow. This settles
 * authorization, refuses a corpus too small to analyse, seeds the record the
 * workflow will patch, and hands the job over — it returns long before there is
 * an analysis to read.
 *
 * The size check runs here rather than in the workflow so a facilitator who asks
 * about an empty phase gets an answer instead of a job that starts, spends a
 * model call, and reports a failure a minute later. It reads `total` from a
 * one-row query, which is the phase's whole count. The workflow re-checks
 * against the corpus it actually assembles, because a phase of three proposals
 * with no body text is a corpus of nothing and only the corpus read knows that.
 *
 * @param input - The instance to analyse.
 * @param user - The calling facilitator, checked for decision admin.
 * @returns The id of the analysis. Combined with the instance and the scope it
 *   forms the cache key, and on its own it names the run's realtime channel.
 * @throws NotFoundError when the instance does not exist.
 * @throws UnauthorizedError when the caller does not hold `decisions: ADMIN` on
 *   the profile that owns the instance.
 * @throws ValidationError when the phase holds too few proposals to compare.
 */
export const requestThemeAnalysis = async ({
  input,
  user,
}: {
  input: RequestThemeAnalysisInput;
  user: User;
}): Promise<{ analysisId: string }> => {
  const { processInstanceId, scope = 'phase' } = input;

  const [instance] = await db
    .select({ profileId: processInstances.profileId })
    .from(processInstances)
    .where(eq(processInstances.id, processInstanceId))
    .limit(1);

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  // `ownerProfileId` is null to skip the organization fallback, matching the
  // proposals export. An analysis is a synthesis of every proposal in the phase,
  // including any hidden from the public, so it stays with admins of the
  // decision profile itself rather than with anyone holding an org-level grant
  // over it. `getThemeAnalysisStatus` asserts the same boundary on the way back
  // out, which is what stops an admin who lost the role from reading a finished
  // analysis for the rest of the record's day.
  await assertInstanceProfileAccess({
    user,
    instance: { profileId: instance.profileId, ownerProfileId: null },
    profilePermissions: { decisions: permission.ADMIN },
    orgFallbackPermissions: { decisions: permission.ADMIN },
  });

  // One row, for the count beside it. Both readers run their count query
  // separately from the data query, so `total` is the scope's full count rather
  // than what this page returned — and it has to be counted in the same scope
  // the run will read, or a results-scoped analysis could be refused for a phase
  // that happens to be empty.
  const { total } = await readProposalsInScope({
    processInstanceId,
    userId: user.id,
    scope,
    limit: 1,
  });

  if (total < THEME_ANALYSIS_MIN_PROPOSALS) {
    throw new ValidationError(
      `A theme analysis needs at least ${THEME_ANALYSIS_MIN_PROPOSALS} proposals to compare. This phase has ${total}.`,
    );
  }

  // Its own id per request, so pressing the button twice produces two analyses
  // rather than one overwriting the other.
  const analysisId = randomUUID();
  const key = themeAnalysisCacheKey({ processInstanceId, scope, analysisId });
  // One value for the seed and the event. The workflow writes whole records and
  // has no other way to know when the run was asked for.
  const createdAt = new Date().toISOString();

  // Seeded in full rather than as an id and a status. The status read checks
  // ownership before anything else, so a partial record fails the first read
  // instead of answering it — and the cache is the only store, so nothing else
  // can supply what the seed omits.
  await set(
    key,
    {
      analysisId,
      processInstanceId,
      userId: user.id,
      status: 'pending',
      createdAt,
    },
    THEME_ANALYSIS_CACHE_TTL_SECONDS,
  );

  // Read the seed back before dispatching the job, because `set` reports
  // nothing: it returns early when no cache is configured, and swallows its own
  // timeouts. Without this check a deployment with no `REDIS_URL` accepts the
  // request, runs both model passes, and hands the caller an id for a record
  // that was never stored — which reads to the client as a run still pending,
  // so the button spins until it reports a timeout for an analysis that
  // succeeded. That is exactly the failure this feature shipped with once.
  //
  // One extra round trip on a button press, and it converts a silent ten-minute
  // wait into an immediate, actionable message.
  const seeded = await getWithStatus(key);

  if (seeded.status !== 'hit') {
    throw new CommonError(
      'Could not store the analysis request. The cache is unavailable, so a result would have nowhere to go.',
    );
  }

  await event.send({
    name: Events.proposalThemeAnalysisRequested.name,
    data: {
      analysisId,
      processInstanceId,
      userId: user.id,
      scope,
      createdAt,
    },
  });

  return { analysisId };
};
