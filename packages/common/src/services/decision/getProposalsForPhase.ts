import { and, db, desc, eq, isNull } from '@op/db/client';
import type { DbClient } from '@op/db/client';
import type { Proposal } from '@op/db/schema';
import {
  decisionTransitionProposals,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';

/**
 * Returns IDs of proposals visible in the current phase. Lean variant for
 * callers that only need IDs (e.g. to pass as a filter to listProposals).
 */
export async function getProposalIdsForPhase({
  instanceId,
  dbClient = db,
}: {
  instanceId: string;
  dbClient?: DbClient;
}): Promise<string[]> {
  try {
    const [latestTransition] = await dbClient
      .select({ id: stateTransitionHistory.id })
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId))
      .orderBy(desc(stateTransitionHistory.transitionedAt))
      .limit(1);

    if (latestTransition) {
      const rows = await dbClient
        .select({ id: decisionTransitionProposals.proposalId })
        .from(decisionTransitionProposals)
        .innerJoin(
          proposals,
          eq(decisionTransitionProposals.proposalId, proposals.id),
        )
        .where(
          and(
            eq(
              decisionTransitionProposals.transitionHistoryId,
              latestTransition.id,
            ),
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
      error,
    });
    throw error;
  }
}

/**
 * Returns the proposals visible in the current phase.
 *
 * - If a phase transition has occurred: returns only proposals that survived
 *   the most-recent transition (linked via decision_transition_proposals).
 *   Note: even a transition without a selection pipeline writes all proposals
 *   to the join table, so the full non-deleted set is returned in that case —
 *   not an indication that filtering occurred.
 * - If no transition exists yet: returns all non-deleted proposals for the instance.
 */
export async function getProposalsForPhase({
  instanceId,
  dbClient = db,
}: {
  instanceId: string;
  dbClient?: DbClient;
}): Promise<Proposal[]> {
  try {
    const [latestTransition] = await dbClient
      .select({ id: stateTransitionHistory.id })
      .from(stateTransitionHistory)
      .where(eq(stateTransitionHistory.processInstanceId, instanceId))
      .orderBy(desc(stateTransitionHistory.transitionedAt))
      .limit(1);

    if (latestTransition) {
      const rows = await dbClient
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
              latestTransition.id,
            ),
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
    console.error('Error fetching proposals for phase:', { instanceId, error });
    throw error;
  }
}
