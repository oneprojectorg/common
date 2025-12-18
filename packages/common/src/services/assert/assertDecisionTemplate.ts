import { db, eq } from '@op/db/client';
import { decisionProcesses } from '@op/db/schema';

import type {
  DecisionSchemaDefinition,
  PhaseDefinition,
} from '../../lib/decisionSchemas/types';
import { CommonError, NotFoundError } from '../../utils';

export interface DecisionTemplate {
  id: string;
  name: string;
  description: string | null;
  schema: DecisionSchemaDefinition;
  firstPhase: PhaseDefinition;
  createdByProfileId: string;
}

/**
 * Fetches a decision template by ID and validates its schema.
 * Returns a strongly typed template with validated DecisionSchemaDefinition.
 */
export async function assertDecisionTemplate(
  templateId: string,
  error: Error = new NotFoundError('Template', templateId),
): Promise<DecisionTemplate> {
  const template = await db.query.decisionProcesses.findFirst({
    where: eq(decisionProcesses.id, templateId),
  });

  if (!template) {
    throw error;
  }

  const schema = template.processSchema as Record<string, unknown>;

  if (!schema.phases || !Array.isArray(schema.phases)) {
    throw new CommonError(
      'Invalid template: expected DecisionSchemaDefinition with phases',
    );
  }

  const firstPhase = schema.phases[0];
  if (!firstPhase) {
    throw new CommonError('Template must have at least one phase');
  }

  return {
    id: template.id,
    name: template.name,
    description: template.description,
    schema: schema as DecisionSchemaDefinition,
    firstPhase: firstPhase as PhaseDefinition,
    createdByProfileId: template.createdByProfileId,
  };
}
