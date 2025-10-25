import type {
  BlockExecutionResult,
  BlockExecutor,
  ExecutionContext,
  SortBlock as SortBlockType,
} from '../types';
import { evaluateExpression } from '../expressionEvaluator';

export class SortBlock implements BlockExecutor<SortBlockType> {
  execute(block: SortBlockType, context: ExecutionContext): BlockExecutionResult {
    const sortedProposals = [...context.proposals].sort((a, b) => {
      for (const sortCriteria of block.sortBy) {
        const aContext = { ...context, proposal: a };
        const bContext = { ...context, proposal: b };

        const aValue =
          typeof sortCriteria.field === 'string'
            ? evaluateExpression({ field: sortCriteria.field }, aContext)
            : evaluateExpression(sortCriteria.field, aContext);

        const bValue =
          typeof sortCriteria.field === 'string'
            ? evaluateExpression({ field: sortCriteria.field }, bContext)
            : evaluateExpression(sortCriteria.field, bContext);

        // Handle nulls
        if (aValue == null && bValue == null) {
          continue;
        }
        if (aValue == null) {
          return sortCriteria.nullsFirst ? -1 : 1;
        }
        if (bValue == null) {
          return sortCriteria.nullsFirst ? 1 : -1;
        }

        // Compare values
        let comparison = 0;

        // Check if types match for safe comparison
        const aType = typeof aValue;
        const bType = typeof bValue;

        if (aType !== bType) {
          // Different types: compare type names for consistency
          comparison = aType < bType ? -1 : aType > bType ? 1 : 0;
        } else if (aValue < bValue) {
          comparison = -1;
        } else if (aValue > bValue) {
          comparison = 1;
        }

        if (comparison !== 0) {
          return sortCriteria.order === 'desc' ? -comparison : comparison;
        }
      }

      return 0;
    });

    return {
      proposals: sortedProposals,
    };
  }
}
