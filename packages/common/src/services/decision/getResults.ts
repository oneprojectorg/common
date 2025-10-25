import { db, desc, eq } from '@op/db/client';
import {
  decisionProcessResults,
  decisionProcessResultSelections,
} from '@op/db/schema';
import type { DecisionProcessResult } from '@op/db/schema';

/**
 * Get the latest result for a process instance
 */
export async function getLatestResult(
  processInstanceId: string,
): Promise<DecisionProcessResult | null> {
  const result = await db.query.decisionProcessResults.findFirst({
    where: eq(decisionProcessResults.processInstanceId, processInstanceId),
    orderBy: [desc(decisionProcessResults.executedAt)],
  });

  return result || null;
}

/**
 * Get all results for a process instance (history)
 */
export async function getResultsHistory(
  processInstanceId: string,
): Promise<DecisionProcessResult[]> {
  const results = await db.query.decisionProcessResults.findMany({
    where: eq(decisionProcessResults.processInstanceId, processInstanceId),
    orderBy: [desc(decisionProcessResults.executedAt)],
  });

  return results;
}

/**
 * Get selected proposal IDs for a specific result
 */
export async function getSelectedProposals(
  processResultId: string,
): Promise<string[]> {
  const selections = await db.query.decisionProcessResultSelections.findMany({
    where: eq(decisionProcessResultSelections.processResultId, processResultId),
    orderBy: [decisionProcessResultSelections.selectionRank],
  });

  return selections.map((s) => s.proposalId);
}

/**
 * Get full result with selected proposals
 */
export async function getResultWithProposals(processResultId: string) {
  const result = await db.query.decisionProcessResults.findFirst({
    where: eq(decisionProcessResults.id, processResultId),
    with: {
      selections: {
        with: {
          proposal: true,
        },
        orderBy: [decisionProcessResultSelections.selectionRank],
      },
    },
  });

  return result;
}

/**
 * Get latest result with selected proposals for a process instance
 */
export async function getLatestResultWithProposals(processInstanceId: string) {
  const result = await db.query.decisionProcessResults.findFirst({
    where: eq(decisionProcessResults.processInstanceId, processInstanceId),
    orderBy: [desc(decisionProcessResults.executedAt)],
    with: {
      selections: {
        with: {
          proposal: true,
        },
        orderBy: [decisionProcessResultSelections.selectionRank],
      },
    },
  });

  return result;
}
