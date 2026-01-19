import { db, eq } from '@op/db/client';
import { decisionProcesses } from '@op/db/schema';

import { NotFoundError } from '../../utils';
import type { DecisionSchemaDefinition } from './schemas/types';

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
    throw new NotFoundError(`Template '${templateId}' not found`);
  }

  return templateRecord.processSchema as DecisionSchemaDefinition;
};
