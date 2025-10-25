import type {
  BlockExecutionResult,
  BlockExecutor,
  ComputeBlock as ComputeBlockType,
  ExecutionContext,
} from '../types';
import { evaluateExpression } from '../expressionEvaluator';

export class ComputeBlock implements BlockExecutor<ComputeBlockType> {
  execute(block: ComputeBlockType, context: ExecutionContext): BlockExecutionResult {
    const variables: Record<string, any> = {};

    for (const [varName, expression] of Object.entries(block.computations)) {
      const value = evaluateExpression(expression, context);
      variables[varName] = value;
    }

    return {
      proposals: context.proposals,
      variables,
    };
  }
}
