import { db } from '@op/db/client';

import { pickProposalTemplate } from './pickProposalTemplate';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { ProposalTemplateSchema } from './types';

/**
 * Resolves the proposal template schema for a process instance.
 *
 * Checks `instanceData.proposalTemplate` first (written when a proposal form
 * is configured per-instance). Falls back to `decisionProcesses.processSchema`
 * (the process-level default) when the instance doesn't carry its own template.
 *
 * TODO: remove or adapt this function. it seems that we just need to fix the typing since we have the data
 *
 */
export async function resolveProposalTemplate(
  instanceData: DecisionInstanceData | Record<string, unknown> | null,
  processId: string,
): Promise<ProposalTemplateSchema | null> {
  const fromInstance = instanceData?.proposalTemplate;

  // Read the process row only when the instance carries no template of its
  // own. The precedence itself stays in `pickProposalTemplate` — encoding it a
  // second time in this function's control flow is what would let the two
  // drift.
  let fromProcess: unknown = null;
  if (!fromInstance) {
    const process = await db.query.decisionProcesses.findFirst({
      where: { id: processId },
      columns: { processSchema: true },
    });

    const processSchema = process?.processSchema as Record<
      string,
      unknown
    > | null;
    fromProcess = processSchema?.proposalTemplate;
  }

  return pickProposalTemplate(fromInstance, fromProcess);
}
