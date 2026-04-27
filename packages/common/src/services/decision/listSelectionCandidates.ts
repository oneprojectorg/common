import { type DbClient, db as defaultDb, eq } from '@op/db/client';
import { proposalCategories } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { isLegacyInstanceData } from './isLegacyInstance';
import { listProposals } from './listProposals';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { Proposal } from './schemas/proposal';

export interface SelectionCandidates {
  proposals: Proposal[];
}

interface ListSelectionCandidatesInput {
  processInstanceId: string;
  user: User;
  /** Filter via the canonical `proposalCategories` join, not `proposalData.category`. */
  categoryId?: string;
  sortOrder?: 'newest' | 'oldest';
  db?: DbClient;
}

/**
 * Admin-gated. Lists proposals eligible to be manually selected into the current
 * phase — i.e. the proposals that belong to the previous phase's membership.
 * Returns an empty list when there is no previous phase (initial or legacy).
 */
export async function listSelectionCandidates({
  processInstanceId,
  user,
  categoryId,
  sortOrder = 'newest',
  db = defaultDb,
}: ListSelectionCandidatesInput): Promise<SelectionCandidates> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
  });

  if (!instance) {
    throw new NotFoundError('Process instance not found');
  }

  if (!instance.profileId) {
    throw new CommonError(
      'Decision instance does not have an associated profile',
    );
  }

  const profileUser = await getProfileAccessUser({
    user,
    profileId: instance.profileId,
  });

  assertAccess({ decisions: permission.ADMIN }, profileUser?.roles ?? []);

  const previousPhaseId = resolvePreviousPhaseId(instance);
  if (!previousPhaseId) {
    return { proposals: [] };
  }

  let categoryProposalIds: Set<string> | undefined;
  if (categoryId) {
    const rows = await db
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(eq(proposalCategories.taxonomyTermId, categoryId));
    if (rows.length === 0) {
      return { proposals: [] };
    }
    categoryProposalIds = new Set(rows.map((r) => r.proposalId));
  }

  const phaseCandidateIds = await getProposalIdsForPhase({
    instanceId: processInstanceId,
    phaseId: previousPhaseId,
    db,
  });

  const candidateIds = categoryProposalIds
    ? phaseCandidateIds.filter((id) => categoryProposalIds.has(id))
    : phaseCandidateIds;

  if (candidateIds.length === 0) {
    return { proposals: [] };
  }

  const { proposals: enriched } = await listProposals({
    input: {
      processInstanceId,
      proposalIds: candidateIds,
      authUserId: user.id,
      limit: candidateIds.length,
      orderBy: 'createdAt',
      dir: sortOrder === 'oldest' ? 'asc' : 'desc',
    },
    user,
  });

  return { proposals: enriched };
}

function resolvePreviousPhaseId(instance: {
  instanceData: unknown;
  currentStateId: string | null;
}): string | undefined {
  if (isLegacyInstanceData(instance.instanceData)) {
    return undefined;
  }

  const currentStateId = instance.currentStateId;
  if (!currentStateId) {
    return undefined;
  }

  const phases = (instance.instanceData as DecisionInstanceData | null)?.phases;
  if (!phases || phases.length === 0) {
    return undefined;
  }

  const currentIndex = phases.findIndex((p) => p.phaseId === currentStateId);
  if (currentIndex <= 0) {
    return undefined;
  }

  return phases[currentIndex - 1]?.phaseId;
}
