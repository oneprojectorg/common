import { and, asc, db, desc, eq, sql } from '@op/db/client';
import { decisionProcesses } from '@op/db/schema';

import { CommonError, NotFoundError } from '../../utils';
import type { DecisionSchemaDefinition } from './schemas/types';

/**
 * A template row to satisfy an instance's foreign key when its template lives
 * in `instance_data`. Prefers the oldest row carrying `schemaId` (the seeded
 * copy; tests and admins insert later ones), else the oldest template.
 * @throws CommonError when there is no template at all
 */
export const findSeededTemplateId = async (
  schemaId: string,
): Promise<string> => {
  const schemaIdOf = sql`${decisionProcesses.processSchema}->>'id'`;
  const [row] = await db
    .select({ id: decisionProcesses.id })
    .from(decisionProcesses)
    .where(
      and(
        sql`${schemaIdOf} IS NOT NULL`,
        sql`${decisionProcesses.processSchema}->>'version' IS NOT NULL`,
        sql`${decisionProcesses.processSchema}->'phases' IS NOT NULL`,
      ),
    )
    .orderBy(
      desc(sql`${schemaIdOf} = ${schemaId}`),
      asc(decisionProcesses.createdAt),
    )
    .limit(1);

  if (!row) {
    throw new CommonError('No decision template has been seeded');
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
