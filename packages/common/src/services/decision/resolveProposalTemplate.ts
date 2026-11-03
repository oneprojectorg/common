import { db } from '@op/db/client';

import type { ProposalTemplateSchema } from './types';

/**
 * Resolves the proposal template schema for a process instance.
 *
 * Checks `instanceData.proposalTemplate` first (written when a proposal form
 * is configured per-instance). Falls back to `decisionProcesses.processSchema`
 * (the process-level default) when the instance doesn't carry its own template.
 * `processId` is null once the template has been deleted; there is no fallback then.
 *
 * TODO: remove or adapt this function. it seems that we just need to fix the typing since we have the data
 *
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isProposalTemplate = (value: unknown): value is ProposalTemplateSchema =>
  isRecord(value) &&
  (value.properties === undefined || isRecord(value.properties)) &&
  (value['x-field-order'] === undefined ||
    (Array.isArray(value['x-field-order']) &&
      value['x-field-order'].every((field) => typeof field === 'string')));

const templateOf = (data: unknown): ProposalTemplateSchema | null =>
  isRecord(data) && isProposalTemplate(data.proposalTemplate)
    ? data.proposalTemplate
    : null;

export async function resolveProposalTemplate(
  instanceData: unknown,
  processId: string | null,
): Promise<ProposalTemplateSchema | null> {
  const fromInstance = templateOf(instanceData);

  if (fromInstance) {
    return fromInstance;
  }

  if (!processId) {
    return null;
  }

  const process = await db.query.decisionProcesses.findFirst({
    where: { id: processId },
    columns: { processSchema: true },
  });

  return templateOf(process?.processSchema);
}
