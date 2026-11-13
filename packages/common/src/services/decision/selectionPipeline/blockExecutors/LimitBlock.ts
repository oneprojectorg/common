import { evaluateExpression } from '../expressionEvaluator';
import type {
  BlockExecutionResult,
  BlockExecutor,
  ExecutionContext,
  LimitBlock as LimitBlockType,
} from '../types';

export class LimitBlock implements BlockExecutor<LimitBlockType> {
  execute(
    block: LimitBlockType,
    context: ExecutionContext,
  ): BlockExecutionResult {
    const scope = { ...context, record: context };
    const count =
      typeof block.count === 'number'
        ? block.count
        : evaluateExpression(block.count, scope);

    const offset = block.offset
      ? typeof block.offset === 'number'
        ? block.offset
        : evaluateExpression(block.offset, scope)
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
