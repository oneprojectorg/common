import { evaluateExpression } from '../expressionEvaluator';
import type {
  BlockExecutionResult,
  BlockExecutor,
  ComputeBlock as ComputeBlockType,
  ExecutionContext,
} from '../types';

export class ComputeBlock implements BlockExecutor<ComputeBlockType> {
  execute(
    block: ComputeBlockType,
    context: ExecutionContext,
  ): BlockExecutionResult {
    const variables: Record<string, any> = {};
    const scope = { ...context, record: context };

    for (const [varName, expression] of Object.entries(block.computations)) {
      const value = evaluateExpression(expression, scope);
      variables[varName] = value;
    }

    return {
      proposals: context.proposals,
      variables,
    };
  }
}
