import { and, db, desc, eq, isNull, ne } from '@op/db/client';
import type { DbClient } from '@op/db/client';
import type { Proposal } from '@op/db/schema';
import {
  ProposalStatus,
  decisionTransitionProposals,
  processInstances,
  proposals,
  stateTransitionHistory,
} from '@op/db/schema';

import { isLegacyInstanceData } from './isLegacyInstance';

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
 * Used for legacy instances and for new instances still in their initial phase.
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
 * Loads the instance's legacy/current-phase context in a single query.
 * Returns null if the instance does not exist.
 */
async function getInstanceContext(
  instanceId: string,
  dbClient: DbClient,
): Promise<{ isLegacy: boolean; currentPhaseId?: string | null } | null> {
  const [row] = await dbClient
    .select({
      instanceData: processInstances.instanceData,
      currentStateId: processInstances.currentStateId,
    })
    .from(processInstances)
    .where(eq(processInstances.id, instanceId))
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    isLegacy: isLegacyInstanceData(row.instanceData),
    currentPhaseId: row.currentStateId,
  };
}

/**
 * Returns IDs of proposals visible in the given phase. Lean variant for
 * callers that only need IDs (e.g. to pass as a filter to listProposals).
 *
 * - Legacy instances (no phases array in instanceData): always returns
 *   all non-draft, non-deleted proposals — phase scoping does not apply.
 * - If a transition into the requested phase exists: returns the proposals that survived
 *   that transition (empty means empty — no fallback).
 * - If no transition exists and the requested phase is the instance's current phase
 *   (i.e. the initial phase, never transitioned into): returns all active proposals.
 * - If a phaseId was passed for a phase the instance hasn't visited: returns [].
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
  const ctx = await getInstanceContext(instanceId, dbClient);

  if (!ctx) {
    return [];
  }

  if (ctx.isLegacy) {
    const fallback = await allActiveProposals(instanceId, dbClient);
    return fallback.map((r) => r.id);
  }

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

  // No transition into the requested phase.
  // If we're sitting on that phase (or no phaseId given → current phase), it's the
  // initial phase that's never been transitioned into → return all active proposals.
  const isCurrentPhase = phaseId == null || phaseId === ctx.currentPhaseId;
  if (isCurrentPhase) {
    const fallback = await allActiveProposals(instanceId, dbClient);
    return fallback.map((r) => r.id);
  }

  return [];
}

/**
 * Returns the proposals visible in the given phase.
 *
 * - Legacy instances (no phases array in instanceData): always returns
 *   all non-draft, non-deleted proposals — phase scoping does not apply.
 * - If a transition into the requested phase exists: returns the proposals that survived
 *   that transition (empty means empty — no fallback).
 * - If no transition exists and the requested phase is the instance's current phase
 *   (i.e. the initial phase, never transitioned into): returns all active proposals.
 * - If a phaseId was passed for a phase the instance hasn't visited: returns [].
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
  const ctx = await getInstanceContext(instanceId, dbClient);

  if (!ctx) {
    return [];
  }

  if (ctx.isLegacy) {
    return allActiveProposals(instanceId, dbClient);
  }

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

  // No transition into the requested phase.
  // If we're sitting on that phase (or no phaseId given → current phase), it's the
  // initial phase that's never been transitioned into → return all active proposals.
  const isCurrentPhase = phaseId == null || phaseId === ctx.currentPhaseId;
  if (isCurrentPhase) {
    return allActiveProposals(instanceId, dbClient);
  }

  return [];
}
