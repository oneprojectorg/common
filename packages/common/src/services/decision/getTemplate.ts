import { asc, db, eq, sql } from '@op/db/client';
import { decisionProcesses } from '@op/db/schema';

import { CommonError, NotFoundError } from '../../utils';
import type { DecisionSchemaDefinition } from './schemas/types';

/**
 * A template row to satisfy an instance's foreign key when its template lives
 * in `instance_data`: the oldest row carrying `schemaId` (the seeded copy;
 * tests and admins insert later ones).
 * @throws CommonError when no row carries `schemaId`
 */
export const getSeededTemplateId = async (
  schemaId: string,
): Promise<string> => {
  const [row] = await db
    .select({ id: decisionProcesses.id })
    .from(decisionProcesses)
    .where(sql`${decisionProcesses.processSchema}->>'id' = ${schemaId}`)
    .orderBy(asc(decisionProcesses.createdAt))
    .limit(1);

  if (!row) {
    throw new CommonError(`No "${schemaId}" decision template has been seeded`);
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
