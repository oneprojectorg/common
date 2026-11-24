import { describe, expect, it } from 'vitest';

import { buildProposalRow } from '../../../../../testing/helpers/proposalRows';
import { ValidationError } from '../../../../utils';
import { getPipelineScores } from '../getPipelineScores';
import type {
  BudgetBlock as BudgetBlockType,
  ExecutionContext,
} from '../types';
import { BudgetBlock } from './BudgetBlock';

const costs = { a: 400, b: 500, c: 200, d: 100 };
const proposals = Object.keys(costs).map((id) => buildProposalRow({ id }));
const proposalCosts = new Map(Object.entries(costs));

function run(
  budget: BudgetBlockType['budget'],
  overrides: Partial<ExecutionContext> = {},
) {
  return new BudgetBlock().execute(
    { id: 'fit-budget', type: 'budget', budget },
    { proposals, proposalCosts, variables: {}, outputs: {}, ...overrides },
  );
}

const ids = (list: Array<{ id: string }>) =>
  list.map((proposal) => proposal.id);

describe('BudgetBlock', () => {
  it('accepts proposals in order while their cost fits and skips the ones that do not', () => {
    const result = run(1000);

    expect(ids(result.proposals)).toEqual(['a', 'b', 'd']);
  });

  it('records each proposal turn, cost and the budget available when its turn came', () => {
    const result = run(1000);

    expect(result.proposals.map(getPipelineScores)).toEqual([
      { position: 1, cost: 400, budgetAvailable: 1000 },
      { position: 2, cost: 500, budgetAvailable: 600 },
      { position: 4, cost: 100, budgetAvailable: 100 },
    ]);
  });

  it('leaves the input rows untouched', () => {
    const before = structuredClone(proposals);

    run(1000);

    expect(proposals).toEqual(before);
  });

  it('reads the budget from a pipeline variable', () => {
    expect(
      ids(
        run({ variable: 'budget' }, { variables: { budget: 900 } }).proposals,
      ),
    ).toEqual(['a', 'b']);
  });

  it('treats a proposal without a price as free', () => {
    const free = buildProposalRow({ id: 'free' });
    const unpriced = new Map([...proposalCosts, ['free', null]]);

    expect(
      ids(
        run(0, { proposals: [free, ...proposals], proposalCosts: unpriced })
          .proposals,
      ),
    ).toEqual(['free']);
  });

  it('raises the pricing error of a proposal it reaches', () => {
    const broken = buildProposalRow({ id: 'broken' });
    const failure = new ValidationError('cannot price broken');
    const withFailure = new Map<string, number | null | ValidationError>([
      ...proposalCosts,
      ['broken', failure],
    ]);

    expect(() =>
      run(1000, {
        proposals: [broken, ...proposals],
        proposalCosts: withFailure,
      }),
    ).toThrow(failure);
  });

  it('ignores the pricing error of a proposal an earlier block dropped', () => {
    const withFailure = new Map<string, number | null | ValidationError>([
      ...proposalCosts,
      ['dropped', new ValidationError('cannot price dropped')],
    ]);

    expect(ids(run(1000, { proposalCosts: withFailure }).proposals)).toEqual([
      'a',
      'b',
      'd',
    ]);
  });

  it('adds decimal costs without drift', () => {
    const cents = [0.1, 0.2].map((_, i) => buildProposalRow({ id: `c${i}` }));
    const centCosts = new Map([
      ['c0', 0.1],
      ['c1', 0.2],
    ]);

    expect(
      ids(run(0.3, { proposals: cents, proposalCosts: centCosts }).proposals),
    ).toEqual(['c0', 'c1']);
  });

  it('rejects a missing budget variable', () => {
    expect(() => run({ variable: 'budget' })).toThrow(ValidationError);
  });

  it('rejects a budget that is not a number', () => {
    expect(() =>
      run({ variable: 'budget' }, { variables: { budget: '900' } }),
    ).toThrow(ValidationError);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects a budget of %s',
    (budget) => {
      expect(() => run(budget)).toThrow(ValidationError);
    },
  );

  it('rejects a phase that prices no proposal field', () => {
    expect(() => run(1000, { proposalCosts: undefined })).toThrow(
      ValidationError,
    );
  });
});
