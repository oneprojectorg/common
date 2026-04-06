import type { RubricTemplateSchema } from '@op/common/client';

/**
 * Minimal rubric fixture used while the review form renderer is being built.
 */
export const REVIEW_RUBRIC_DUMMY_TEMPLATE: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': ['structuralBarriers'],
  properties: {
    structuralBarriers: {
      type: 'integer',
      title: 'Addressing Structural Barriers',
      description:
        "Does this proposal address structural barriers and inequities in philanthropy? Consider the organization's access to traditional funding, the novelty of their model, and whether they face systemic barriers to resources.",
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: '1 - Very weak' },
        { const: 2, title: '2 - Weak' },
        { const: 3, title: '3 - Adequate' },
        { const: 4, title: '4 - Strong' },
        { const: 5, title: '5 - Excellent' },
      ],
    },
  },
  required: ['structuralBarriers'],
};
