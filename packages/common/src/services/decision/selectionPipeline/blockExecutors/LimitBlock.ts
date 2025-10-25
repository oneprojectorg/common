import type {
  BlockExecutionResult,
  BlockExecutor,
  ExecutionContext,
  LimitBlock as LimitBlockType,
} from '../types';
import { evaluateExpression } from '../expressionEvaluator';

export class LimitBlock implements BlockExecutor<LimitBlockType> {
  execute(block: LimitBlockType, context: ExecutionContext): BlockExecutionResult {
    const count =
      typeof block.count === 'number'
        ? block.count
        : evaluateExpression(block.count, context);

    const offset = block.offset
      ? typeof block.offset === 'number'
        ? block.offset
        : evaluateExpression(block.offset, context)
      : 0;

    // Ensure non-negative values
    const validCount = Math.max(0, Number(count));
    const validOffset = Math.max(0, Number(offset));

    const limitedProposals = context.proposals.slice(
      validOffset,
      validOffset + validCount,
    );

    return {
      proposals: limitedProposals,
    };
  }
}
