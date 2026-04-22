import { and, db, desc, eq, inArray, isNull, ne } from '@op/db/client';
import type { DbClient } from '@op/db/client';
import type { Proposal } from '@op/db/schema';
import {
  ProposalStatus,
  decisionTransitionProposals,
  proposalCategories,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils';
import { getProfileAccessUser } from '../access';
import { isLegacyInstanceData } from './isLegacyInstance';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { TransitionData } from './schemas/transitionData';

export interface ManualSelectionState {
  /** False only when the inbound transition has zero proposals and no `manualSelection` stamp. */
  selectionsConfirmed: boolean;
  candidates: Proposal[];
}

interface GetManualSelectionStateInput {
  processInstanceId: string;
  user: User;
  /** Filter via the canonical `proposalCategories` join, not `proposalData.category`. */
  categoryId?: string;
  dbClient?: DbClient;
}

/** Admin-gated. Returns whether the current phase still needs a manual selection + eligible candidates. */
export async function getManualSelectionState({
  processInstanceId,
  user,
  categoryId,
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
    return { selectionsConfirmed: true, candidates: [] };
  }

  const { previousPhaseId } = resolved;

  const [previousTransition] = await dbClient
    .select({ id: stateTransitionHistory.id })
    .from(stateTransitionHistory)
    .where(
      and(
        eq(stateTransitionHistory.processInstanceId, processInstanceId),
        eq(stateTransitionHistory.toStateId, previousPhaseId),
      ),
    )
    .orderBy(desc(stateTransitionHistory.transitionedAt))
    .limit(1);

  // Short-circuit empty category matches before the larger fetch.
  let categoryProposalIds: string[] | undefined;
  if (categoryId) {
    const rows = await dbClient
      .select({ proposalId: proposalCategories.proposalId })
      .from(proposalCategories)
      .where(eq(proposalCategories.taxonomyTermId, categoryId));
    categoryProposalIds = rows.map((r) => r.proposalId);
    if (categoryProposalIds.length === 0) {
      return { selectionsConfirmed: false, candidates: [] };
    }
  }

  const candidates: Proposal[] = previousTransition
    ? (
        await dbClient
          .select({ proposal: proposals })
          .from(decisionTransitionProposals)
          .innerJoin(
            proposals,
            eq(decisionTransitionProposals.proposalId, proposals.id),
          )
          .where(
            and(
              eq(
                decisionTransitionProposals.transitionHistoryId,
                previousTransition.id,
              ),
              ne(proposals.status, ProposalStatus.DRAFT),
              isNull(proposals.deletedAt),
              ...(categoryProposalIds
                ? [inArray(proposals.id, categoryProposalIds)]
                : []),
            ),
          )
      ).map((r) => r.proposal)
    : await dbClient
        .select()
        .from(proposals)
        .where(
          and(
            eq(proposals.processInstanceId, processInstanceId),
            ne(proposals.status, ProposalStatus.DRAFT),
            isNull(proposals.deletedAt),
            ...(categoryProposalIds
              ? [inArray(proposals.id, categoryProposalIds)]
              : []),
          ),
        );

  return { selectionsConfirmed: false, candidates };
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
