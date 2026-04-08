import { and, db, desc, eq, isNull, ne } from '@op/db/client';
import type { DbClient } from '@op/db/client';
import type { Proposal } from '@op/db/schema';
import {
  ProposalStatus,
  decisionTransitionProposals,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';

/**
 * Resolves the transition to use for phase-scoped proposal queries.
 *
 * - If phaseId is provided: finds the most recent transition that entered that phase (toStateId = phaseId).
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
      .orderBy(desc(stateTransitionHistory.transitionedAt))
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
 * All non-draft, non-deleted proposals for an instance.
 * Used as the fallback when no transition exists or when a legacy transition
 * has no join-table rows (instance transitioned before join-table writes were added).
 */
function allActiveProposals(instanceId: string, dbClient: DbClient) {
  return dbClient
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.processInstanceId, instanceId),
        ne(proposals.status, ProposalStatus.DRAFT),
        isNull(proposals.deletedAt),
      ),
    );
}

/**
 * Returns IDs of proposals visible in the given phase. Lean variant for
 * callers that only need IDs (e.g. to pass as a filter to listProposals).
 *
 * - If phaseId is provided: returns proposals that survived the transition into that phase.
 *   Returns [] if phaseId does not match any recorded transition.
 * - If phaseId is omitted: returns proposals for the current (most recent) phase.
 * - If no transition exists yet: returns all non-draft, non-deleted proposals for the instance.
 * - Legacy fallback: if a transition exists but the join table is empty (instance
 *   transitioned before join-table writes were added), returns all active proposals.
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
  const transition = await resolveTransition(instanceId, phaseId, dbClient);

  if (phaseId && !transition) {
    return [];
  }

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

    // Legacy fallback: transition exists but join table was never populated
    if (rows.length === 0) {
      const fallback = await allActiveProposals(instanceId, dbClient);
      return fallback.map((r) => r.id);
    }

    return rows.map((r) => r.id);
  }

  const fallback = await allActiveProposals(instanceId, dbClient);
  return fallback.map((r) => r.id);
}

/**
 * Returns the proposals visible in the given phase.
 *
 * - If phaseId is provided: returns proposals that survived the transition into that phase.
 *   Returns [] if phaseId does not match any recorded transition.
 * - If phaseId is omitted: returns proposals for the current (most recent) phase.
 * - If no transition exists yet: returns all non-draft, non-deleted proposals for the instance.
 * - Legacy fallback: if a transition exists but the join table is empty (instance
 *   transitioned before join-table writes were added), returns all active proposals.
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
  const transition = await resolveTransition(instanceId, phaseId, dbClient);

  if (phaseId && !transition) {
    return [];
  }

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

    // Legacy fallback: transition exists but join table was never populated
    if (rows.length === 0) {
      return allActiveProposals(instanceId, dbClient);
    }

    return rows.map((r) => r.proposal);
  }

  return allActiveProposals(instanceId, dbClient);
}
