import { db, eq } from '@op/db/client';
import { decisionProcessTransitions, processInstances } from '@op/db/schema';

import { CommonError, ValidationError } from '../../utils';
import { isResultsPhaseLocked, validatePhaseDates } from './dateValidation';
import type { InstanceData, PhaseConfiguration } from './types';

export interface UpdateProcessScheduleInput {
  processInstanceId: string;
  updatedPhases: PhaseConfiguration[];
}

export interface UpdateProcessScheduleResult {
  success: boolean;
  updatedTransitions: number;
  autoCompletedTransitions: number;
}

/**
 * Updates the process schedule (phase dates) and corresponding transitions.
 * Automatically marks transitions as complete if their dates are now in the past.
 * Prevents updates if the results phase has been locked.
 */
export async function updateProcessSchedule({
  processInstanceId,
  updatedPhases,
}: UpdateProcessScheduleInput): Promise<UpdateProcessScheduleResult> {
  const now = new Date();

  try {
    const instance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, processInstanceId),
    });

    if (!instance) {
      throw new CommonError('Process instance not found');
    }

    const instanceData = instance.instanceData as InstanceData;
    const currentPhases = instanceData.phases || [];

    if (isResultsPhaseLocked(currentPhases, now)) {
      throw new ValidationError(
        'Cannot update process schedule - results phase has been entered and is locked',
      );
    }

    const validation = validatePhaseDates(updatedPhases, now);
    if (!validation.isValid) {
      const errorMessages = validation.errors
        .map((e) => `Phase ${e.phaseIndex + 1}: ${e.message}`)
        .join('; ');
      throw new ValidationError(`Invalid phase dates: ${errorMessages}`);
    }

    const existingTransitions = await db.query.decisionProcessTransitions.findMany({
      where: eq(decisionProcessTransitions.processInstanceId, processInstanceId),
    });

    let updatedCount = 0;
    let autoCompletedCount = 0;

    for (let i = 0; i < updatedPhases.length; i++) {
      const phase = updatedPhases[i];

      if (!phase) {
        continue;
      }

      const scheduledEnd = phase.plannedEndDate || phase.actualEndDate;

      if (!scheduledEnd) {
        continue;
      }

      const scheduledDate = new Date(scheduledEnd);
      const existingTransition = existingTransitions.find(
        (t) => t.toStateId === phase.stateId,
      );

      if (existingTransition) {
        const shouldBeCompleted = scheduledDate < now;

        const updateData: {
          scheduledDate: Date;
          completed?: boolean;
          completedAt?: Date;
          autoProcessed?: boolean;
        } = {
          scheduledDate,
        };

        if (shouldBeCompleted && !existingTransition.completed) {
          updateData.completed = true;
          updateData.completedAt = new Date();
          updateData.autoProcessed = true;
          autoCompletedCount++;
        }

        await db
          .update(decisionProcessTransitions)
          .set(updateData)
          .where(eq(decisionProcessTransitions.id, existingTransition.id));

        updatedCount++;

        if (shouldBeCompleted) {
          await db
            .update(processInstances)
            .set({
              currentStateId: phase.stateId,
              instanceData: {
                ...instanceData,
                currentStateId: phase.stateId,
                phases: updatedPhases,
              },
            })
            .where(eq(processInstances.id, processInstanceId));
        }
      }
    }

    if (autoCompletedCount === 0) {
      await db
        .update(processInstances)
        .set({
          instanceData: {
            ...instanceData,
            phases: updatedPhases,
          },
        })
        .where(eq(processInstances.id, processInstanceId));
    }

    return {
      success: true,
      updatedTransitions: updatedCount,
      autoCompletedTransitions: autoCompletedCount,
    };
  } catch (error) {
    if (error instanceof ValidationError || error instanceof CommonError) {
      throw error;
    }
    console.error('Error updating process schedule:', error);
    throw new CommonError('Failed to update process schedule');
  }
}
