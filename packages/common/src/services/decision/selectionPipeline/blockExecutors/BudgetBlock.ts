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
        : evaluateExpression(block.budget, { ...context, record: context });

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
    let acceptedTotal = 0;

    context.proposals.forEach((proposal, index) => {
      const priced = proposalCosts.get(proposal.id);
      // Only a proposal the walk reaches can block the selection.
      if (priced instanceof Error) {
        throw priced;
      }
      // Unpriced costs nothing, as on a ballot.
      const cost = priced ?? 0;
      const budgetAvailable = sumAmounts([budget, -acceptedTotal]);
      const fits = isAtMost({
        amount: sumAmounts([acceptedTotal, cost]),
        limit: budget,
      });
      const walked: Proposal = structuredClone(proposal);
      setValueByPath(walked, 'metadata.position', index + 1);
      setValueByPath(walked, 'metadata.cost', cost);
      setValueByPath(walked, 'metadata.budgetAvailable', budgetAvailable);

      if (fits) {
        acceptedTotal = sumAmounts([acceptedTotal, cost]);
        accepted.push(walked);
      }
    });

    return { proposals: accepted };
  }
}
