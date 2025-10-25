import type { Proposal } from '@op/db/schema';

import type {
  BlockExecutionResult,
  BlockExecutor,
  ExecutionContext,
  TransformBlock as TransformBlockType,
} from '../types';
import {
  evaluateExpression,
  setValueByPath,
} from '../expressionEvaluator';

export class TransformBlock implements BlockExecutor<TransformBlockType> {
  execute(
    block: TransformBlockType,
    context: ExecutionContext,
  ): BlockExecutionResult {
    const transformedProposals = context.proposals.map((proposal) => {
      const proposalContext = {
        ...context,
        proposal,
      };

      // Create a deep copy of the proposal to avoid mutations
      // structuredClone is available in Node 17+ and modern browsers
      const transformedProposal: Proposal = structuredClone(proposal);

      // Apply each transformation
      for (const [fieldPath, expression] of Object.entries(
        block.transformations,
      )) {
        const value = evaluateExpression(expression, proposalContext);
        setValueByPath(transformedProposal, fieldPath, value);
      }

      return transformedProposal;
    });

    return {
      proposals: transformedProposals,
    };
  }
}
