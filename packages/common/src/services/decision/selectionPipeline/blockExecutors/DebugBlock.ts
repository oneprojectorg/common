import { logger } from '@op/logging';

import { getValueByPath } from '../expressionEvaluator';
import type {
  BlockExecutionResult,
  BlockExecutor,
  DebugBlock as DebugBlockType,
  ExecutionContext,
} from '../types';

// Used to add a logging step into the pipeline
export class DebugBlock implements BlockExecutor<DebugBlockType> {
  execute(
    block: DebugBlockType,
    context: ExecutionContext,
  ): BlockExecutionResult {
    const fields = block.logFields ?? [];

    logger.debug('Selection pipeline debug block', {
      blockId: block.id,
      message: block.message,
      proposalCount: context.proposals.length,
      proposalFields:
        fields.length > 0
          ? context.proposals.map((proposal, index) => ({
              index: index + 1,
              proposalId: proposal.id,
              values: Object.fromEntries(
                fields.map((field) => [field, getValueByPath(proposal, field)]),
              ),
            }))
          : undefined,
      variables: context.variables,
      outputs: Object.keys(context.outputs),
    });

    return {
      proposals: context.proposals,
    };
  }
}
