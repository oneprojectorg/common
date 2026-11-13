import type { Proposal } from '@op/db/schema';

import { ValidationError } from '../../../../utils';
import { isAtMost, sumAmounts } from '../../fieldUnit';
import { evaluateExpression, setValueByPath } from '../expressionEvaluator';
import type {
  BlockExecutionResult,
  BlockExecutor,
  BudgetBlock as BudgetBlockType,
  ExecutionContext,
} from '../types';

export class BudgetBlock implements BlockExecutor<BudgetBlockType> {
  execute(
    block: BudgetBlockType,
    context: ExecutionContext,
  ): BlockExecutionResult {
    const budget =
      typeof block.budget === 'number'
        ? block.budget
        : evaluateExpression(block.budget, context);

    if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 0) {
      throw new ValidationError(
        'The selection needs a non-negative budget. Set the budget in the phase settings.',
      );
    }

    const { proposalCosts } = context;

    if (!proposalCosts) {
      throw new ValidationError(
        'The selection needs proposal costs, but this phase prices no proposal field.',
      );
    }

    const accepted: Proposal[] = [];
    const skipped: Proposal[] = [];
    let acceptedTotal = 0;

    context.proposals.forEach((proposal, index) => {
      // Mirrors the ballot validator: an unpriced proposal costs nothing.
      const cost = proposalCosts.get(proposal.id) ?? 0;
      const budgetRemaining = sumAmounts([budget, -acceptedTotal]);
      const fits = isAtMost({
        amount: sumAmounts([acceptedTotal, cost]),
        limit: budget,
      });
      const walked: Proposal = structuredClone(proposal);
      setValueByPath(walked, 'metadata.position', index + 1);
      setValueByPath(walked, 'metadata.cost', cost);
      setValueByPath(walked, 'metadata.budgetRemaining', budgetRemaining);

      if (fits) {
        acceptedTotal = sumAmounts([acceptedTotal, cost]);
        accepted.push(walked);
      } else {
        skipped.push(walked);
      }
    });

    return { proposals: accepted, skipped };
  }
}
