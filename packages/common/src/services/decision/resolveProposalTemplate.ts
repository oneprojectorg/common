import { db } from '@op/db/client';

/**
 * Resolves the proposal template schema for a process instance.
 *
 * Checks `instanceData.proposalTemplate` first (written when a proposal form
 * is configured per-instance). Falls back to `decisionProcesses.processSchema`
 * (the process-level default) when the instance doesn't carry its own template.
 */
export async function resolveProposalTemplate(
  instanceData: Record<string, unknown> | null,
  processId: string,
): Promise<Record<string, unknown> | null> {
  const fromInstance =
    (instanceData?.proposalTemplate as Record<string, unknown>) ?? null;

  if (fromInstance) {
    return fromInstance;
  }

  const process = await db.query.decisionProcesses.findFirst({
    where: { id: processId },
    columns: { processSchema: true },
  });

  const processSchema = process?.processSchema as Record<
    string,
    unknown
  > | null;

  return (processSchema?.proposalTemplate as Record<string, unknown>) ?? null;
}
