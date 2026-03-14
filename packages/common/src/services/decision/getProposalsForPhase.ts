import { and, db, desc, eq, isNull } from '@op/db/client';
import type { Proposal } from '@op/db/schema';
import {
  decisionTransitionProposals,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';

/**
 * Returns the proposals visible in the current phase.
 *
 * - If a phase transition has occurred: returns only proposals that survived
 *   the most-recent transition (linked via decision_transition_proposals).
 * - If no transition exists yet: returns all non-deleted proposals for the instance.
 */
export async function getProposalsForPhase({
  instanceId,
}: {
  instanceId: string;
}): Promise<Proposal[]> {
  const latestTransition = await db
    .select({ id: stateTransitionHistory.id })
    .from(stateTransitionHistory)
    .where(eq(stateTransitionHistory.processInstanceId, instanceId))
    .orderBy(desc(stateTransitionHistory.transitionedAt))
    .limit(1);

  if (latestTransition.length > 0) {
    const transitionId = latestTransition[0]!.id;

    const rows = await db
      .select({ proposal: proposals })
      .from(decisionTransitionProposals)
      .innerJoin(
        proposals,
        eq(decisionTransitionProposals.proposalId, proposals.id),
      )
      .where(
        and(
          eq(decisionTransitionProposals.transitionHistoryId, transitionId),
          isNull(proposals.deletedAt),
        ),
      );

    return rows.map((r) => r.proposal);
  }

  return db
    .select()
    .from(proposals)
    .where(
      and(
        eq(proposals.processInstanceId, instanceId),
        isNull(proposals.deletedAt),
      ),
    );
}
