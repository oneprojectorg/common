import { count, db, eq, inArray } from '@op/db/client';
import {
  ProposalStatus,
  decisionProcessResultSelections,
  decisionProcessResults,
  decisionsVoteSubmissions,
  proposals,
} from '@op/db/schema';

import { CommonError } from '../../utils';
import { getProposalsForPhase } from './getProposalsForPhase';
import type { DecisionInstanceData } from './schemas/instanceData';
import {
  aggregateProposalMetrics,
  defaultSelectionPipeline,
  executeSelectionPipeline,
} from './selectionPipeline';
import type { ExecutionContext } from './selectionPipeline/types';

/** Execute the selection pipeline and store winning proposals. */
export async function processResults({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<{
  success: boolean;
  resultId: string;
  selectedProposalIds: string[];
  error?: string;
}> {
  try {
    const processInstance = await db.query.processInstances.findFirst({
      where: { id: processInstanceId },
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

    const instanceData = processInstance.instanceData as DecisionInstanceData;
    const currentPhaseId = instanceData.currentPhaseId;

    const processProposals = await getProposalsForPhase({
      instanceId: processInstanceId,
    });

    const currentPhase = instanceData.phases?.find(
      (p) => p.phaseId === currentPhaseId,
    );
    const pipeline =
      currentPhase?.selectionPipeline ?? defaultSelectionPipeline;

    let selectedProposalIds: string[] = [];
    let error: string | undefined;
    let success = false;

    try {
      const proposalMetrics = await aggregateProposalMetrics(processProposals);
      const context: ExecutionContext = {
        proposals: processProposals,
        voteData: proposalMetrics,
        variables: {},
        outputs: {},
      };

      const selectedProposals = await executeSelectionPipeline(
        pipeline,
        context,
      );
      selectedProposalIds = selectedProposals.map((p) => p.id);
      success = true;
    } catch (err) {
      console.error('Error executing selection pipeline:', err);
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const voterCountResult = await db
      .select({ count: count() })
      .from(decisionsVoteSubmissions)
      .where(eq(decisionsVoteSubmissions.processInstanceId, processInstanceId));
    const voterCount = voterCountResult[0]?.count || 0;

    const result = await db.transaction(async (tx) => {
      const [resultRecord] = await tx
        .insert(decisionProcessResults)
        .values({
          processInstanceId,
          success,
          errorMessage: error,
          selectedCount: selectedProposalIds.length,
          voterCount,
          pipelineConfig:
            pipeline === defaultSelectionPipeline ? null : pipeline,
        })
        .returning();

      if (!resultRecord) {
        throw new CommonError('Failed to create process result record');
      }

      if (selectedProposalIds.length > 0) {
        await tx.insert(decisionProcessResultSelections).values(
          selectedProposalIds.map((proposalId) => ({
            processResultId: resultRecord.id,
            proposalId,
            selectionRank: 0,
          })),
        );

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

    try {
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
