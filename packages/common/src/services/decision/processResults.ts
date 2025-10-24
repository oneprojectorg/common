import { db, eq } from '@op/db/client';
import { processInstances, proposals } from '@op/db/schema';
import type { ProcessInstance, Proposal, DecisionProcess } from '@op/db/schema';

import { CommonError } from '../../utils';
import type { InstanceData, ProcessResults, ProcessSchema } from './types';

/**
 * Selection function signature - takes proposals and returns selected proposal IDs
 */
export type SelectionFunction = (
  proposals: Proposal[],
  processInstance: ProcessInstance,
) => Promise<string[]> | string[];

/**
 * Registry of selection functions that can be used to determine which proposals succeed
 */
const selectionFunctions = new Map<string, SelectionFunction>();

/**
 * Register a selection function
 */
export function registerSelectionFunction(
  id: string,
  fn: SelectionFunction,
): void {
  selectionFunctions.set(id, fn);
}

/**
 * Default selection function - selects all submitted proposals
 */
const defaultSelectionFunction: SelectionFunction = async (proposals) => {
  return proposals
    .filter((p) => p.status === 'submitted' || p.status === 'approved')
    .map((p) => p.id);
};

// Register the default selection function
registerSelectionFunction('default', defaultSelectionFunction);

/**
 * Example selection function - selects top N proposals by some criteria
 * This is just an example - real implementations would be registered by the application
 */
registerSelectionFunction('top-n', async (proposals) => {
  // Sort by created date (oldest first) and take top 10
  const sorted = [...proposals].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
  return sorted.slice(0, 10).map((p) => p.id);
});

export interface ProcessResultsInput {
  processInstanceId: string;
}

export interface ProcessResultsOutput {
  success: boolean;
  selectedProposalIds: string[];
  error?: string;
}

/**
 * Process results for a process instance by executing the selection function
 * and storing the selected proposal IDs
 */
export async function processResults({
  processInstanceId,
}: ProcessResultsInput): Promise<ProcessResultsOutput> {
  try {
    // Get the process instance
    const processInstance = await db.query.processInstances.findFirst({
      where: eq(processInstances.id, processInstanceId),
      with: {
        process: true,
      },
    });

    if (!processInstance) {
      throw new CommonError(`Process instance not found: ${processInstanceId}`);
    }

    if (!processInstance.process) {
      throw new CommonError(
        `Process not found for instance: ${processInstanceId}`,
      );
    }

    // Check if results have already been processed
    const instanceData = processInstance.instanceData as InstanceData;
    if (instanceData.results) {
      console.log(
        `Results already processed for process instance ${processInstanceId}`,
      );
      return {
        success: !instanceData.results.error,
        selectedProposalIds: instanceData.results.selectedProposalIds,
        error: instanceData.results.error,
      };
    }

    // Get all proposals for this process instance
    const processProposals = await db.query.proposals.findMany({
      where: eq(proposals.processInstanceId, processInstanceId),
    });

    // Get the selection function ID from the process schema
    const process = processInstance.process as DecisionProcess;
    const processSchema = process.processSchema as ProcessSchema;
    const selectionFunctionId = processSchema.selectionFunctionId || 'default';

    // Get the selection function
    const selectionFunction = selectionFunctions.get(selectionFunctionId);

    if (!selectionFunction) {
      throw new CommonError(
        `Selection function not found: ${selectionFunctionId}. Available functions: ${Array.from(selectionFunctions.keys()).join(', ')}`,
      );
    }

    let selectedProposalIds: string[] = [];
    let error: string | undefined;

    try {
      // Execute the selection function
      selectedProposalIds = await selectionFunction(
        processProposals,
        processInstance,
      );
    } catch (err) {
      console.error('Error executing selection function:', err);
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    // Store the results in the process instance
    const results: ProcessResults = {
      selectedProposalIds,
      executedAt: new Date().toISOString(),
      selectionFunctionId,
      error,
    };

    const updatedInstanceData: InstanceData = {
      ...instanceData,
      results,
    };

    await db
      .update(processInstances)
      .set({
        instanceData: updatedInstanceData,
      })
      .where(eq(processInstances.id, processInstanceId));

    return {
      success: !error,
      selectedProposalIds,
      error,
    };
  } catch (error) {
    console.error('Error processing results:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Try to store the error in the instance data
    try {
      const processInstance = await db.query.processInstances.findFirst({
        where: eq(processInstances.id, processInstanceId),
      });

      if (processInstance) {
        const instanceData = processInstance.instanceData as InstanceData;
        const results: ProcessResults = {
          selectedProposalIds: [],
          executedAt: new Date().toISOString(),
          error: errorMessage,
        };

        await db
          .update(processInstances)
          .set({
            instanceData: {
              ...instanceData,
              results,
            },
          })
          .where(eq(processInstances.id, processInstanceId));
      }
    } catch (updateError) {
      console.error('Failed to store error in instance data:', updateError);
    }

    throw new CommonError(`Failed to process results: ${errorMessage}`);
  }
}
