import { type TransactionType, db, eq } from '@op/db/client';
import { decisionProcesses, decisionProcessTransitions } from '@op/db/schema';
import type { ProcessInstance } from '@op/db/schema';

import { CommonError } from '../../utils';
import type { DecisionInstanceData } from './schemas/instanceData';
import type { DecisionSchemaDefinition, PhaseDefinition } from './schemas/types';
import type { ScheduledTransition } from './types';

/**
 * Creates scheduled transition records for phases with date-based advancement.
 * Each transition fires when the current phase's end date arrives.
 *
 * Note: This function looks up rules from the process schema (template) since
 * instance data phases may not include rules when created via API.
 */
export async function createTransitionsForProcess({
  processInstance,
  tx,
}: {
  processInstance: ProcessInstance;
  tx?: TransactionType;
}): Promise<{
  transitions: Array<{
    id: string;
    fromStateId: string | null;
    toStateId: string;
    scheduledDate: Date;
  }>;
}> {
  const dbClient = tx ?? db;

  try {
    // Type assertion: instanceData is `unknown` in DB to support legacy formats for viewing,
    // but this function is only called for new DecisionInstanceData processes
    const instanceData = processInstance.instanceData as DecisionInstanceData;
    const phases = instanceData.phases;

    if (!phases || phases.length === 0) {
      throw new CommonError(
        'Process instance must have at least one phase configured',
      );
    }

    // Fetch the process schema to get phase rules (instance data may not include rules)
    const process = await dbClient._query.decisionProcesses.findFirst({
      where: eq(decisionProcesses.id, processInstance.processId),
    });

    if (!process) {
      throw new CommonError(
        `Process not found for instance: ${processInstance.id}`,
      );
    }

    const processSchema = process.processSchema as DecisionSchemaDefinition;
    const schemaPhases = processSchema?.phases || [];

    // Build a map of phase ID to schema phase for quick lookup
    const schemaPhasesMap = new Map<string, PhaseDefinition>(
      schemaPhases.map((phase) => [phase.id, phase]),
    );

    // Create transitions for phases that use date-based advancement
    // A transition is created FROM a phase (when it ends) TO the next phase
    const transitionsToCreate: ScheduledTransition[] = [];

    phases.forEach((currentPhase, index) => {
      const nextPhase = phases[index + 1];
      // Skip last phase (no next phase to transition to)
      if (!nextPhase) {
        return;
      }

      // Look up rules from instance data first, then fall back to schema
      const schemaPhase = schemaPhasesMap.get(currentPhase.phaseId);
      const advancementMethod =
        currentPhase.rules?.advancement?.method ??
        schemaPhase?.rules?.advancement?.method;

      // Only create transition if current phase uses date-based advancement
      if (advancementMethod !== 'date') {
        return;
      }

      // Schedule transition when the current phase ends
      const scheduledDate = currentPhase.endDate;

      if (!scheduledDate) {
        throw new CommonError(
          `Phase "${currentPhase.phaseId}" must have an end date for date-based advancement (instance: ${processInstance.id})`,
        );
      }

      // DB columns are named fromStateId/toStateId but store phase IDs
      transitionsToCreate.push({
        processInstanceId: processInstance.id,
        fromStateId: currentPhase.phaseId,
        toStateId: nextPhase.phaseId,
        scheduledDate: new Date(scheduledDate).toISOString(),
      });
    });

    if (transitionsToCreate.length === 0) {
      return { transitions: [] };
    }

    const createdTransitions = await dbClient
      .insert(decisionProcessTransitions)
      .values(transitionsToCreate)
      .returning();

    return {
      transitions: createdTransitions.map((transition) => ({
        id: transition.id,
        fromStateId: transition.fromStateId,
        toStateId: transition.toStateId,
        scheduledDate: new Date(transition.scheduledDate),
      })),
    };
  } catch (error) {
    if (error instanceof CommonError) {
      throw error;
    }
    console.error('Error creating transitions for process:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new CommonError(
      `Failed to create process transitions: ${errorMessage}`,
    );
  }
}
