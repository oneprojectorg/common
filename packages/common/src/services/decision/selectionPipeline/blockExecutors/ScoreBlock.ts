import type { Proposal } from '@op/db/schema';

import type {
  BlockExecutionResult,
  BlockExecutor,
  ExecutionContext,
  Expression,
  ScoreBlock as ScoreBlockType,
  ScoringCriteria,
} from '../types';
import { evaluateExpression, setValueByPath } from '../expressionEvaluator';

export class ScoreBlock implements BlockExecutor<ScoreBlockType> {
  execute(block: ScoreBlockType, context: ExecutionContext): BlockExecutionResult {
    const scoredProposals = context.proposals.map((proposal) => {
      const proposalContext = {
        ...context,
        proposal,
      };

      let score: number;

      if (Array.isArray(block.formula)) {
        // Composite score from multiple criteria
        score = this.calculateCompositeScore(
          block.formula,
          proposalContext,
          context.proposals,
        );
      } else {
        // Direct expression evaluation
        const result = evaluateExpression(block.formula, proposalContext);
        score = typeof result === 'number' ? result : 0;
      }

      // Create a deep copy and set the score
      // structuredClone is available in Node 17+ and modern browsers
      const scoredProposal: Proposal = structuredClone(proposal);
      setValueByPath(scoredProposal, block.scoreField, score);

      return scoredProposal;
    });

    return {
      proposals: scoredProposals,
    };
  }

  private calculateCompositeScore(
    criteria: ScoringCriteria[],
    proposalContext: ExecutionContext,
    allProposals: Proposal[],
  ): number {
    let totalScore = 0;

    for (const criterion of criteria) {
      let value: number;

      // Get the raw value
      if (criterion.field) {
        const fieldExpr =
          typeof criterion.field === 'string'
            ? { field: criterion.field }
            : criterion.field;
        const result = evaluateExpression(fieldExpr, proposalContext);
        value = typeof result === 'number' ? result : 0;
      } else if (criterion.expression) {
        const result = evaluateExpression(criterion.expression, proposalContext);
        value = typeof result === 'number' ? result : 0;
      } else {
        continue;
      }

      // Normalize if requested
      if (criterion.normalize) {
        value = this.normalizeValue(
          value,
          criterion.field,
          allProposals,
          proposalContext,
        );
      }

      // Invert if requested
      if (criterion.invert) {
        value = 1 - value;
      }

      // Apply weight
      totalScore += value * criterion.weight;
    }

    return totalScore;
  }

  private normalizeValue(
    value: number,
    field: string | Expression | undefined,
    allProposals: Proposal[],
    baseContext: ExecutionContext,
  ): number {
    if (!field) {
      return value;
    }

    // Get all values for this field
    const fieldExpr =
      typeof field === 'string' ? { field: field } : field;
    const values = allProposals
      .map((p) => {
        const ctx = { ...baseContext, proposal: p };
        const result = evaluateExpression(fieldExpr, ctx);
        return typeof result === 'number' ? result : 0;
      })
      .filter((v) => typeof v === 'number');

    if (values.length === 0) {
      return 0;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    // Avoid division by zero
    if (max === min) {
      return 0.5;
    }

    // Normalize to 0-1
    return (value - min) / (max - min);
  }
}
