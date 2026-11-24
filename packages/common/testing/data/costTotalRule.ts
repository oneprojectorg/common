import type { Expression } from '../../src/services/decision/selectionPipeline/types';

const costFields = [
  'answers.cost_design',
  'answers.cost_construction',
  'answers.cost_contingency',
];

/**
 * The total of a review's three money cost answers, as a mapping rule writes
 * it. A cost answer that is present and is not money gives no total.
 */
export const costTotalExpression: Expression = {
  function: 'if',
  arguments: [
    {
      and: costFields.map((field) => ({
        or: [
          { not: { field } },
          { function: 'isMoney', arguments: [{ field }] },
        ],
      })),
    },
    {
      function: 'money',
      arguments: [
        {
          function: 'decimalSum',
          arguments: costFields.map((field) => ({ field: `${field}.amount` })),
        },
        {
          function: 'same',
          arguments: costFields.map((field) => ({
            field: `${field}.currency`,
          })),
        },
      ],
    },
    { value: null },
  ],
};
