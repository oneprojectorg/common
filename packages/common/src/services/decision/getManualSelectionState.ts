import { db, desc, eq } from '@op/db/client';
import type { DbClient } from '@op/db/client';
import {
  decisionTransitionProposals,
  proposalCategories,
  stateTransitionHistory,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { getProposalIdsForPhase } from './getProposalsForPhase';
import { isLegacyInstanceData } from './isLegacyInstance';
import { listProposals } from './listProposals';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { Proposal } from './schemas/proposal';
import type { TransitionData } from './schemas/transitionData';

export interface ManualSelectionState {
  /** False only when the inbound transition has zero proposals and no `manualSelection` stamp. */
  selectionsConfirmed: boolean;
  proposals: Proposal[];
}

interface GetManualSelectionStateInput {
  processInstanceId: string;
  user: User;
  /** Filter via the canonical `proposalCategories` join, not `proposalData.category`. */
  categoryId?: string;
  sortOrder?: 'newest' | 'oldest';
  dbClient?: DbClient;
}

/** Admin-gated. Returns whether the current phase still needs a manual selection + eligible candidates. */
export async function getManualSelectionState({
  processInstanceId,
  user,
  categoryId,
  sortOrder = 'newest',
  dbClient = db,
}: GetManualSelectionStateInput): Promise<ManualSelectionState> {
  const instance = await dbClient.query.processInstances.findFirst({
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

  const resolved = await resolveManualSelectionStatus({
    processInstanceId,
    instance: {
      instanceData: instance.instanceData,
      currentStateId: instance.currentStateId,
    },
    dbClient,
  });

  if (resolved.selectionsConfirmed) {
    return { selectionsConfirmed: true, proposals: [] };
  }

  const { previousPhaseId } = resolved;

  // Short-circuit empty category matches before the larger fetch.
  let categoryProposalIds: Set<string> | undefined;
  if (categoryId) {
    const rows = await dbClient
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(eq(proposalCategories.taxonomyTermId, categoryId));
    if (rows.length === 0) {
      return { selectionsConfirmed: false, proposals: [] };
    }
    categoryProposalIds = new Set(rows.map((r) => r.proposalId));
  }

  const phaseCandidateIds = await getProposalIdsForPhase({
    instanceId: processInstanceId,
    phaseId: previousPhaseId,
    dbClient,
  });

  const candidateIds = categoryProposalIds
    ? phaseCandidateIds.filter((id) => categoryProposalIds.has(id))
    : phaseCandidateIds;

  if (candidateIds.length === 0) {
    return { selectionsConfirmed: false, proposals: [] };
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

  return { selectionsConfirmed: false, proposals: enriched };
}

type ResolvedStatus =
  | { selectionsConfirmed: true }
  | { selectionsConfirmed: false; previousPhaseId: string };

/** Boolean-only resolver for `getInstance`; pass `instance` to skip the findFirst. */
export async function resolveManualSelectionStatus({
  processInstanceId,
  instance: preloadedInstance,
  dbClient = db,
}: {
  processInstanceId: string;
  instance?: {
    instanceData: unknown;
    currentStateId: string | null;
  };
  dbClient?: DbClient;
}): Promise<ResolvedStatus> {
  const instance =
    preloadedInstance ??
    (await dbClient.query.processInstances.findFirst({
      where: { id: processInstanceId },
    }));

  if (!instance) {
    throw new NotFoundError('Process instance not found');
  }

  if (isLegacyInstanceData(instance.instanceData)) {
    return { selectionsConfirmed: true };
  }

  const currentStateId = instance.currentStateId;
  if (!currentStateId) {
    return { selectionsConfirmed: true };
  }

  const instanceData = instance.instanceData as DecisionInstanceData | null;
  const phases = instanceData?.phases;
  if (!phases || phases.length === 0) {
    return { selectionsConfirmed: true };
  }

  const currentPhaseIndex = phases.findIndex(
    (p) => p.phaseId === currentStateId,
  );
  if (currentPhaseIndex <= 0) {
    return { selectionsConfirmed: true };
  }

  const previousPhase = phases[currentPhaseIndex - 1];
  if (!previousPhase) {
    return { selectionsConfirmed: true };
  }

  const [latestRow] = await dbClient
    .select({
      id: stateTransitionHistory.id,
      toStateId: stateTransitionHistory.toStateId,
      transitionData: stateTransitionHistory.transitionData,
    })
    .from(stateTransitionHistory)
    .where(eq(stateTransitionHistory.processInstanceId, processInstanceId))
    .orderBy(desc(stateTransitionHistory.transitionedAt))
    .limit(1);

  if (!latestRow || latestRow.toStateId !== currentStateId) {
    return { selectionsConfirmed: true };
  }

  const hasManualSelectionStamp = Boolean(
    (latestRow.transitionData as TransitionData | null | undefined)
      ?.manualSelection,
  );

  if (hasManualSelectionStamp) {
    return { selectionsConfirmed: true };
  }

  const [attached] = await dbClient
    .select({ id: decisionTransitionProposals.transitionHistoryId })
    .from(decisionTransitionProposals)
    .where(eq(decisionTransitionProposals.transitionHistoryId, latestRow.id))
    .limit(1);

  if (attached) {
    return { selectionsConfirmed: true };
  }

  return { selectionsConfirmed: false, previousPhaseId: previousPhase.phaseId };
}
