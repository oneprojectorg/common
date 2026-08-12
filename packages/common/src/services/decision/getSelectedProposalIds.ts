import { db, eq } from '@op/db/client';
import { decisionProcessResultSelections } from '@op/db/schema';

/**
 * Returns the set of proposal IDs that were selected in the latest results
 * run for the given instance. Used to derive `isSelected` on proposal list
 * rows — distinct from `proposals.status === SELECTED`, which is an
 * editorial column an admin can edit independently of the actual selection.
 *
 * Returns an empty set when the instance has no result rows yet.
 */
export const getSelectedProposalIds = async (
  processInstanceId: string,
): Promise<Set<string>> => {
  const latest = await db.query.decisionProcessResults.findFirst({
    // Failed and reverted runs stay in the table as audit records but never
    // describe the instance's current selection.
    where: { processInstanceId, success: true },
    orderBy: (table, { desc }) => desc(table.executedAt),
  });

  if (!latest) {
    return new Set();
  }

  const rows = await db
    .select({ proposalId: decisionProcessResultSelections.proposalId })
    .from(decisionProcessResultSelections)
    .where(eq(decisionProcessResultSelections.processResultId, latest.id));

  return new Set(rows.map((r) => r.proposalId));
};
