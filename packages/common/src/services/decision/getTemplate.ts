import { asc, db, eq, sql } from '@op/db/client';
import { decisionProcesses } from '@op/db/schema';

import { NotFoundError } from '../../utils';
import type { DecisionSchemaDefinition } from './schemas/types';

/**
 * The oldest template row whose schema carries `schemaId`: the seeded copy,
 * since tests and admins insert later ones.
 * @throws NotFoundError when nothing was seeded
 */
export const findTemplateIdBySchemaId = async (
  schemaId: string,
): Promise<string> => {
  const [row] = await db
    .select({ id: decisionProcesses.id })
    .from(decisionProcesses)
    .where(sql`${decisionProcesses.processSchema}->>'id' = ${schemaId}`)
    .orderBy(asc(decisionProcesses.createdAt))
    .limit(1);

  if (!row) {
    throw new NotFoundError('Template', schemaId);
  }

  return row.id;
};

/**
 * Fetches a decision template by ID from the database.
 * @throws NotFoundError if the template doesn't exist
 */
export const getTemplate = async (
  templateId: string,
): Promise<DecisionSchemaDefinition> => {
  const templateRecord = await db._query.decisionProcesses.findFirst({
    where: eq(decisionProcesses.id, templateId),
  });

  if (!templateRecord) {
    throw new NotFoundError('Template', templateId);
  }

  return templateRecord.processSchema as DecisionSchemaDefinition;
};
