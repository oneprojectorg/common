import { db } from '@op/db/client';
import type { processInstances } from '@op/db/schema';

import { NotFoundError, ValidationError } from '../../utils';
import type { ProposalTemplateSchema } from './types';

/**
 * Resolves the proposal template schema for a proposal.
 *
 * Row first: when `formSchemaId` is set, the template is that
 * `decision_form_schemas` row's schema. A missing row throws `NotFoundError`
 * (the FK guarantees it exists, so falling back would validate against the
 * wrong template); a row whose schema is not a proposal template throws
 * `ValidationError`.
 *
 * Otherwise checks `instanceData.proposalTemplate` (written when a proposal
 * form is configured per-instance), then falls back to
 * `decisionProcesses.processSchema` (the process-level default).
 * `processId` is null once the template has been deleted; there is no fallback then.
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

/**
 * List form of `resolveProposalTemplate`. It runs one query over the distinct
 * non-null `formSchemaId` values, and at most one instance → process
 * resolution when a proposal has no `formSchemaId`.
 * Returns a lookup by proposal id. The lookup throws `NotFoundError` for an
 * id that was not passed in.
 */
export async function resolveProposalTemplates({
  proposals,
  instance,
}: {
  proposals: ReadonlyArray<{ id: string; formSchemaId: string | null }>;
  instance: Pick<
    typeof processInstances.$inferSelect,
    'instanceData' | 'processId'
  >;
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
