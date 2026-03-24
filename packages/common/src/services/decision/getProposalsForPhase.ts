import { and, db, desc, eq, isNull } from '@op/db/client';
import type { DbClient } from '@op/db/client';
import type { Proposal } from '@op/db/schema';
import {
  decisionTransitionProposals,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';

/**
 * Resolves the transition to use for phase-scoped proposal queries.
 *
 * - If phaseId is provided: finds the transition that entered that phase (toStateId = phaseId).
 * - If phaseId is omitted: uses the most recent transition (current phase).
 * - Returns undefined if no matching transition exists (e.g. still in the initial phase).
 */
async function resolveTransition(
  instanceId: string,
  phaseId: string | undefined,
  dbClient: DbClient,
) {
  if (phaseId) {
    const [transition] = await dbClient
      .select({ id: stateTransitionHistory.id })
      .from(stateTransitionHistory)
      .where(
        and(
          eq(stateTransitionHistory.processInstanceId, instanceId),
          eq(stateTransitionHistory.toStateId, phaseId),
        ),
      )
      .limit(1);
    return transition;
  }

  const [latestTransition] = await dbClient
    .select({ id: stateTransitionHistory.id })
    .from(stateTransitionHistory)
    .where(eq(stateTransitionHistory.processInstanceId, instanceId))
    .orderBy(desc(stateTransitionHistory.transitionedAt))
    .limit(1);
  return latestTransition;
}

/**
 * Returns IDs of proposals visible in the given phase. Lean variant for
 * callers that only need IDs (e.g. to pass as a filter to listProposals).
 *
 * - If phaseId is provided: returns proposals that survived the transition into that phase.
 * - If phaseId is omitted: returns proposals for the current (most recent) phase.
 * - If no transition exists yet: returns all non-deleted proposals for the instance.
 */
export async function getProposalIdsForPhase({
  instanceId,
  phaseId,
  dbClient = db,
}: {
  instanceId: string;
  phaseId?: string;
  dbClient?: DbClient;
}): Promise<string[]> {
  try {
    const transition = await resolveTransition(instanceId, phaseId, dbClient);

    if (transition) {
      const rows = await dbClient
        .select({ id: decisionTransitionProposals.proposalId })
        .from(decisionTransitionProposals)
        .innerJoin(
          proposals,
          eq(decisionTransitionProposals.proposalId, proposals.id),
        )
        .where(
          and(
            eq(decisionTransitionProposals.transitionHistoryId, transition.id),
            isNull(proposals.deletedAt),
          ),
        );
      return rows.map((r) => r.id);
    }

    const rows = await dbClient
      .select({ id: proposals.id })
      .from(proposals)
      .where(
        and(
          eq(proposals.processInstanceId, instanceId),
          isNull(proposals.deletedAt),
        ),
      );
    return rows.map((r) => r.id);
  } catch (error) {
    console.error('Error fetching proposal IDs for phase:', {
      instanceId,
      phaseId,
      error,
    });
    throw error;
  }
}

/**
 * Returns the proposals visible in the given phase.
 *
 * - If phaseId is provided: returns proposals that survived the transition into that phase.
 * - If phaseId is omitted: returns proposals for the current (most recent) phase.
 * - If no transition exists yet: returns all non-deleted proposals for the instance.
 *   Note: even a transition without a selection pipeline writes all proposals to the join
 *   table, so the full non-deleted set is returned in that case — not an indication that
 *   filtering occurred.
 */
export async function getProposalsForPhase({
  instanceId,
  phaseId,
  dbClient = db,
}: {
  instanceId: string;
  phaseId?: string;
  dbClient?: DbClient;
}): Promise<Proposal[]> {
  try {
    const transition = await resolveTransition(instanceId, phaseId, dbClient);

    if (transition) {
      const rows = await dbClient
        .select({ proposal: proposals })
        .from(decisionTransitionProposals)
        .innerJoin(
          proposals,
          eq(decisionTransitionProposals.proposalId, proposals.id),
        )
        .where(
          and(
            eq(decisionTransitionProposals.transitionHistoryId, transition.id),
            isNull(proposals.deletedAt),
          ),
        );
      return rows.map((r) => r.proposal);
    }

    return dbClient
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.processInstanceId, instanceId),
          isNull(proposals.deletedAt),
        ),
      );
  } catch (error) {
    console.error('Error fetching proposals for phase:', {
      instanceId,
      phaseId,
      error,
    });
    throw error;
  }
}
