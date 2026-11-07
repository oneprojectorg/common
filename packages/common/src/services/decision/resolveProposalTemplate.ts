import { db } from '@op/db/client';

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
export async function resolveProposalTemplate({
  formSchemaId,
  instanceData,
  processId,
}: {
  formSchemaId?: string | null;
  instanceData: unknown;
  processId: string | null;
}): Promise<ProposalTemplateSchema | null> {
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
 * List form of `resolveProposalTemplate`: one query over the distinct non-null
 * `formSchemaIds` and at most one instance → process resolution for null.
 * Returns a lookup that gives each row its own template; it throws
 * `NotFoundError` for an id that was not passed in.
 */
export async function resolveProposalTemplatesByFormSchemaId({
  formSchemaIds,
  instanceData,
  processId,
}: {
  formSchemaIds: ReadonlyArray<string | null>;
  instanceData: unknown;
  processId: string | null;
}): Promise<(formSchemaId: string | null) => ProposalTemplateSchema | null> {
  const ids = [
    ...new Set(formSchemaIds.filter((id): id is string => id !== null)),
  ];
  const needsInstanceTemplate = formSchemaIds.some((id) => id === null);

  const [rows, instanceTemplate] = await Promise.all([
    ids.length > 0
      ? db.query.formSchemas.findMany({
          where: { id: { in: ids } },
          columns: { id: true, schema: true },
        })
      : [],
    needsInstanceTemplate
      ? resolveInstanceTemplate({ instanceData, processId })
      : null,
  ]);

  const templates = new Map<string, ProposalTemplateSchema>();
  for (const row of rows) {
    templates.set(row.id, asProposalTemplate(row.schema));
  }

  const missing = ids.find((id) => !templates.has(id));
  if (missing) {
    throw new NotFoundError('Form schema', missing);
  }

  return (formSchemaId) => {
    if (formSchemaId === null) {
      return instanceTemplate;
    }

    const template = templates.get(formSchemaId);
    if (!template) {
      throw new NotFoundError('Form schema', formSchemaId);
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
