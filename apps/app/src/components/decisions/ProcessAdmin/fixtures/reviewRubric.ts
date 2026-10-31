import type { ProcessAdminPhase } from '../types';

/** Two scored criteria and a yes/no, in the stored rubric shape. */
export const reviewRubric: NonNullable<ProcessAdminPhase['rubricTemplate']> = {
  type: 'object',
  'x-field-order': ['impact', 'feasibility', 'meetsEligibility'],
  properties: {
    impact: {
      type: 'integer',
      title: 'Impact',
      description: 'How many residents the project would reach.',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Very few' },
        { const: 2, title: 'A street' },
        { const: 3, title: 'A block' },
        { const: 4, title: 'A district' },
        { const: 5, title: 'The whole neighbourhood' },
      ],
    },
    feasibility: {
      type: 'integer',
      title: 'Feasibility',
      description: 'Whether the budget and timeline hold up.',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Unlikely' },
        { const: 2, title: 'Doubtful' },
        { const: 3, title: 'Possible' },
        { const: 4, title: 'Likely' },
        { const: 5, title: 'Certain' },
      ],
    },
    meetsEligibility: {
      type: 'string',
      title: 'Meets eligibility',
      description: 'Is the project within the fund rules?',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'no', title: 'No' },
      ],
    },
  },
};
