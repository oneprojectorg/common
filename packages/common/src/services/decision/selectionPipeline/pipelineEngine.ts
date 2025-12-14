import type { Proposal } from '@op/db/schema';

import { CommonError } from '../../../utils';
import { getBlockExecutor } from './blockExecutors';
import { evaluateExpression } from './expressionEvaluator';
import type { BranchBlock, ExecutionContext, SelectionPipeline } from './types';

/**
 * Execute a selection pipeline
 */
export async function executePipeline(
  pipeline: SelectionPipeline,
  context: ExecutionContext,
): Promise<Proposal[]> {
  try {
    // Initialize variables from pipeline
    if (pipeline.variables) {
      context.variables = {
        ...context.variables,
        ...pipeline.variables,
      };
    }

    // Execute blocks sequentially
    let currentProposals = context.proposals;
    let previousOutput = 'proposals'; // Default input name

    for (const block of pipeline.blocks) {
      // Determine input source
      const inputName = block.input || previousOutput;
      const inputProposals =
        inputName === 'proposals'
          ? currentProposals
          : Array.isArray(context.outputs[inputName])
            ? context.outputs[inputName]
            : currentProposals;

      // Create execution context for this block
      const blockContext: ExecutionContext = {
        ...context,
        proposals: inputProposals,
      };

      // Get and execute the block executor
      const executor = getBlockExecutor(block);
      const result = await executor.execute(block, blockContext);

      // Update current proposals
      currentProposals = result.proposals;

      // Store output
      const outputName = block.output || `block_${block.id}_output`;
      context.outputs[outputName] =
        result.output !== undefined ? result.output : result.proposals;
      previousOutput = outputName;

      // Merge variables
      if (result.variables) {
        context.variables = {
          ...context.variables,
          ...result.variables,
        };
      }

      // Handle branch blocks specially
      if (block.type === 'branch') {
        const branchBlock = block as BranchBlock;
        currentProposals = await executeBranchBlock(
          branchBlock,
          blockContext,
          context,
        );
      }
    }

    // Return the final output
    if (pipeline.output) {
      const finalOutput = context.outputs[pipeline.output];
      return Array.isArray(finalOutput) ? finalOutput : currentProposals;
    }

    return currentProposals;
  } catch (error) {
    console.error('Error executing pipeline:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    throw new CommonError(`Pipeline execution failed: ${errorMessage}`);
  }
}

/**
 * Execute a branch block with nested pipelines
 */
async function executeBranchBlock(
  block: BranchBlock,
  blockContext: ExecutionContext,
  parentContext: ExecutionContext,
): Promise<Proposal[]> {
  // Check each branch condition
  for (const branch of block.branches) {
    const conditionResult = evaluateExpression(branch.condition, blockContext);

    if (conditionResult) {
      // Execute this branch's blocks as a nested pipeline
      const branchPipeline: SelectionPipeline = {
        version: '1.0.0',
        blocks: branch.blocks,
      };

      const branchResults = await executePipeline(branchPipeline, {
        ...blockContext,
        outputs: { ...blockContext.outputs },
        variables: { ...blockContext.variables },
      });

      // Store branch output
      if (branch.output) {
        parentContext.outputs[branch.output] = branchResults;
      }

      return branchResults;
    }
  }

  // Execute default branch if no condition matched
  if (block.default) {
    const defaultPipeline: SelectionPipeline = {
      version: '1.0.0',
      blocks: block.default.blocks,
    };

    const defaultResults = await executePipeline(defaultPipeline, {
      ...blockContext,
      outputs: { ...blockContext.outputs },
      variables: { ...blockContext.variables },
    });

    // Store default output
    if (block.default.output) {
      parentContext.outputs[block.default.output] = defaultResults;
    }

    return defaultResults;
  }

  // No branch matched and no default - return original proposals
  return blockContext.proposals;
}
