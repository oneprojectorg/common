import { db } from '@op/db/client';

import { normalizeProposalTemplate } from './normalizeProposalTemplate';
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
  const fromInstance =
    (instanceData?.proposalTemplate as ProposalTemplateSchema) ?? null;

  if (fromInstance) {
    return normalizeProposalTemplate(fromInstance);
  }

  const process = await db.query.decisionProcesses.findFirst({
    where: { id: processId },
    columns: { processSchema: true },
  });

  const processSchema = process?.processSchema as Record<
    string,
    unknown
  > | null;

  const fromProcess =
    (processSchema?.proposalTemplate as ProposalTemplateSchema) ?? null;

  return fromProcess ? normalizeProposalTemplate(fromProcess) : null;
}
