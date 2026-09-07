import { set } from '@op/cache';
import { db, eq } from '@op/db/client';
import { processInstances } from '@op/db/schema';
import { Events, event } from '@op/events';
import { User } from '@op/supabase/lib';
import { permission } from 'access-zones';
import { randomUUID } from 'crypto';

import { NotFoundError, ValidationError } from '../../utils';
import { assertInstanceProfileAccess } from '../access';
import { listProposals } from './listProposals';
import {
  THEME_ANALYSIS_CACHE_TTL_SECONDS,
  THEME_ANALYSIS_MIN_PROPOSALS,
  themeAnalysisCacheKey,
} from './themes';

export interface RequestThemeAnalysisInput {
  processInstanceId: string;
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
 * @returns The id of the analysis, which is also its cache key and its channel.
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
  const { processInstanceId } = input;

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

  // One row, for the count beside it. `listProposals` runs its count query
  // separately from the data query, so `total` is the phase's full count rather
  // than what this page returned.
  const { total } = await listProposals({
    input: {
      processInstanceId,
      limit: 1,
      skipAccessCheck: true,
    },
    user: { id: user.id },
  });

  if (total < THEME_ANALYSIS_MIN_PROPOSALS) {
    throw new ValidationError(
      `A theme analysis needs at least ${THEME_ANALYSIS_MIN_PROPOSALS} proposals to compare. This phase has ${total}.`,
    );
  }

  const analysisId = randomUUID();
  // One instant for the seed and the event, so the record the workflow writes
  // and the record the request wrote agree about when this was asked for.
  const createdAt = new Date().toISOString();

  // Seeded in full rather than as an id and a status. The status contract
  // requires `processInstanceId` and `userId` — the read checks ownership before
  // it checks anything else — so a partial record fails the first read instead of
  // answering it. This cache is the only store of analysis state; no table
  // stands behind it, so nothing else can supply what the seed omits.
  await set(
    themeAnalysisCacheKey(analysisId),
    {
      analysisId,
      processInstanceId,
      userId: user.id,
      status: 'pending',
      createdAt,
    },
    THEME_ANALYSIS_CACHE_TTL_SECONDS,
  );

  await event.send({
    name: Events.proposalThemeAnalysisRequested.name,
    data: {
      analysisId,
      processInstanceId,
      userId: user.id,
      createdAt,
    },
  });

  return { analysisId };
};
