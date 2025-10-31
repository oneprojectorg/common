import { db, eq, inArray, count } from '@op/db/client';
import {
  ProposalStatus,
  decisionProcessResultSelections,
  decisionProcessResults,
  decisionsVoteSubmissions,
  processInstances,
  proposals,
} from '@op/db/schema';
import type { DecisionProcess } from '@op/db/schema';

import { CommonError } from '../../utils';
import {
  aggregateVoteData,
  defaultSelectionPipeline,
  executePipeline,
} from './selectionPipeline';
import type { ExecutionContext } from './selectionPipeline/types';
import type { InstanceData, ProcessSchema } from './types';

export interface ProcessResultsInput {
  processInstanceId: string;
}

export interface ProcessResultsOutput {
  success: boolean;
  resultId: string;
  selectedProposalIds: string[];
  error?: string;
}

/**
 * Process results for a process instance by executing the selection pipeline
 * and storing the selected proposal IDs in the database
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

    // Get all proposals for this process instance
    const processProposals = await db.query.proposals.findMany({
      where: eq(proposals.processInstanceId, processInstanceId),
    });

    // Get the process schema
    const process = processInstance.process as DecisionProcess;
    const processSchema = process.processSchema as ProcessSchema;
    const instanceData = processInstance.instanceData as InstanceData;

    let selectedProposalIds: string[] = [];
    let error: string | undefined;
    let success = false;

    try {
      // Use the defined pipeline or fall back to default
      const pipeline =
        processSchema.selectionPipeline || defaultSelectionPipeline;

      // Aggregate voting data
      const voteData = await aggregateVoteData(processInstanceId);

      // Build execution context
      const context: ExecutionContext = {
        proposals: processProposals,
        voteData,
        process: {
          instanceId: processInstance.id,
          processId: processInstance.processId,
          currentStateId: processInstance.currentStateId,
          instanceData,
          processSchema,
          processInstance,
        },
        variables: {},
        outputs: {},
      };

      // Execute the pipeline
      const selectedProposals = await executePipeline(pipeline, context);
      selectedProposalIds = selectedProposals.map((p) => p.id);
      success = true;
    } catch (err) {
      console.error('Error executing selection pipeline:', err);
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    // Count the number of voters for this process instance
    const voterCountResult = await db
      .select({ count: count() })
      .from(decisionsVoteSubmissions)
      .where(eq(decisionsVoteSubmissions.processInstanceId, processInstanceId));

    const voterCount = voterCountResult[0]?.count || 0;

    const result = await db.transaction(async (tx) => {
      // Store the results in the database
      const [resultRecord] = await tx
        .insert(decisionProcessResults)
        .values({
          processInstanceId,
          success,
          errorMessage: error,
          selectedCount: selectedProposalIds.length,
          voterCount,
          pipelineConfig: processSchema.selectionPipeline || null,
        })
        .returning();

      if (!resultRecord) {
        throw new CommonError('Failed to create process result record');
      }

      // Insert selected proposals into junction table
      if (selectedProposalIds.length > 0) {
        await tx.insert(decisionProcessResultSelections).values(
          selectedProposalIds.map((proposalId) => ({
            processResultId: resultRecord.id,
            proposalId,
            selectionRank: 0, // Default to 0. This is used for things like ranked voting
          })),
        );

        // Update proposal status to 'selected' for selected proposals
        await tx
          .update(proposals)
          .set({ status: ProposalStatus.SELECTED })
          .where(inArray(proposals.id, selectedProposalIds));
      }

      return {
        success,
        resultId: resultRecord.id,
        selectedProposalIds,
        error,
      };
    });

    return result;
  } catch (error) {
    console.error('Error processing results:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    // Try to store the error in the database
    try {
      // Count the number of voters for this process instance
      const voterCountResult = await db
        .select({ count: count() })
        .from(decisionsVoteSubmissions)
        .where(
          eq(decisionsVoteSubmissions.processInstanceId, processInstanceId),
        );

      const voterCount = voterCountResult[0]?.count || 0;

      const [resultRecord] = await db
        .insert(decisionProcessResults)
        .values({
          processInstanceId,
          success: false,
          errorMessage,
          selectedCount: 0,
          voterCount,
          pipelineConfig: null,
        })
        .returning();

      if (resultRecord) {
        return {
          success: false,
          resultId: resultRecord.id,
          selectedProposalIds: [],
          error: errorMessage,
        };
      }
    } catch (insertError) {
      console.error('Failed to store error in database:', insertError);
    }

    throw new CommonError(`Failed to process results: ${errorMessage}`);
  }
}
