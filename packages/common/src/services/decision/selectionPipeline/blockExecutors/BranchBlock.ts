import type {
  BlockExecutionResult,
  BlockExecutor,
  BranchBlock as BranchBlockType,
  ExecutionContext,
} from '../types';

/**
 * Branch block executor
 *
 * Note: The actual branching logic with nested pipeline execution is handled
 * in pipelineEngine.ts by the executeBranchBlock function. This executor
 * is only used for condition evaluation.
 */
export class BranchBlock implements BlockExecutor<BranchBlockType> {
  execute(
    _block: BranchBlockType,
    context: ExecutionContext,
  ): BlockExecutionResult {
    // The pipeline engine handles the actual execution of branch.blocks
    // This executor is primarily for type safety and validation
    // See pipelineEngine.ts:executeBranchBlock for the full implementation

    return {
      proposals: context.proposals,
    };
  }
}
