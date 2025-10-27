import type {
  BlockExecutionResult,
  BlockExecutor,
  ExecutionContext,
  FilterBlock as FilterBlockType,
} from '../types';
import { evaluateExpression } from '../expressionEvaluator';

export class FilterBlock implements BlockExecutor<FilterBlockType> {
  execute(block: FilterBlockType, context: ExecutionContext): BlockExecutionResult {
    const filteredProposals = context.proposals.filter((proposal) => {
      const proposalContext = {
        ...context,
        proposal,
      };

      const result = evaluateExpression(block.condition, proposalContext);
      return Boolean(result);
    });

    return {
      proposals: filteredProposals,
    };
  }
}
