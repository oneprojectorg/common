import { db } from '@op/db/client';
import type { ProcessInstance } from '@op/db/schema';

import { NotFoundError, ValidationError } from '../../utils';
import type { ProposalTemplateSchema } from './types';

/**
 * Resolves a proposal's template: the `formSchemaId` row when set, otherwise
 * `instanceData.proposalTemplate`, then the process schema.
 * A missing form schema row throws; there is no fallback to another template.
 */
export async function resolveProposalTemplate(
  instanceData: unknown,
  processId: string | null,
  formSchemaId?: string | null,
): Promise<ProposalTemplateSchema | null> {
  if (formSchemaId) {
    const row = await db.query.formSchemas.findFirst({
      where: { id: formSchemaId },
      columns: { schema: true },
    });

    if (!row) {
      throw new NotFoundError('Form schema', formSchemaId);
    }

    return asProposalTemplate(row.schema);
  }

  return resolveInstanceTemplate({ instanceData, processId });
}

/** List form of `resolveProposalTemplate`. Returns a lookup by proposal id. */
export async function resolveProposalTemplates({
  proposals,
  instance,
}: {
  proposals: ReadonlyArray<{ id: string; formSchemaId: string | null }>;
  instance: Pick<ProcessInstance, 'instanceData' | 'processId'>;
}): Promise<(proposalId: string) => ProposalTemplateSchema | null> {
  const formSchemaIds = [
    ...new Set(
      proposals
        .map((proposal) => proposal.formSchemaId)
        .filter((id): id is string => id !== null),
    ),
  ];
  const needsInstanceTemplate = proposals.some(
    (proposal) => proposal.formSchemaId === null,
  );

  const [rows, instanceTemplate] = await Promise.all([
    formSchemaIds.length > 0
      ? db.query.formSchemas.findMany({
          where: { id: { in: formSchemaIds } },
          columns: { id: true, schema: true },
        })
      : [],
    needsInstanceTemplate ? resolveInstanceTemplate(instance) : null,
  ]);

  const formTemplates = new Map<string, ProposalTemplateSchema>();
  for (const row of rows) {
    formTemplates.set(row.id, asProposalTemplate(row.schema));
  }

  const templates = new Map<string, ProposalTemplateSchema | null>();
  for (const proposal of proposals) {
    if (proposal.formSchemaId === null) {
      templates.set(proposal.id, instanceTemplate);
      continue;
    }

    const template = formTemplates.get(proposal.formSchemaId);
    if (!template) {
      throw new NotFoundError('Form schema', proposal.formSchemaId);
    }

    templates.set(proposal.id, template);
  }

  return (proposalId) => {
    const template = templates.get(proposalId);
    if (template === undefined) {
      throw new NotFoundError('Proposal', proposalId);
    }

    return template;
  };
}

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

const asProposalTemplate = (schema: unknown): ProposalTemplateSchema => {
  if (!isProposalTemplate(schema)) {
    throw new ValidationError('Form schema is not a proposal template');
  }

  return schema;
};

async function resolveInstanceTemplate({
  instanceData,
  processId,
}: {
  instanceData: unknown;
  processId: string | null;
}): Promise<ProposalTemplateSchema | null> {
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
