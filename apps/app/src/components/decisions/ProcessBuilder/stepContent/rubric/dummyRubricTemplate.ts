import type { RubricTemplateSchema } from '@op/common/client';

/**
 * Dummy rubric template used while the rubric builder is under development.
 * Exercises every supported field type so the participant preview is representative.
 */
export const DUMMY_RUBRIC_TEMPLATE: RubricTemplateSchema = {
  type: 'object',
  'x-field-order': [
    'innovation',
    'innovation__rationale',
    'feasibility',
    'feasibility__rationale',
    'meetsEligibility',
    'focusArea',
    'strengthsSummary',
    'overallComments',
  ],
  properties: {
    innovation: {
      type: 'integer',
      title: 'Innovation',
      description: 'Rate the innovation level of the proposal.',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Poor' },
        { const: 2, title: 'Below Average' },
        { const: 3, title: 'Average' },
        { const: 4, title: 'Good' },
        { const: 5, title: 'Excellent' },
      ],
    },
    innovation__rationale: {
      type: 'string',
      title: 'Reason(s) and Insight(s)',
      'x-format': 'long-text',
    },
    feasibility: {
      type: 'integer',
      title: 'Feasibility',
      description: 'Rate the feasibility of the proposal.',
      'x-format': 'dropdown',
      minimum: 1,
      maximum: 5,
      oneOf: [
        { const: 1, title: 'Poor' },
        { const: 2, title: 'Below Average' },
        { const: 3, title: 'Average' },
        { const: 4, title: 'Good' },
        { const: 5, title: 'Excellent' },
      ],
    },
    feasibility__rationale: {
      type: 'string',
      title: 'Reason(s) and Insight(s)',
      'x-format': 'long-text',
    },
    meetsEligibility: {
      type: 'string',
      title: 'Meets Eligibility',
      description: 'Does the proposal meet eligibility requirements?',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'yes', title: 'Yes' },
        { const: 'no', title: 'No' },
      ],
    },
    focusArea: {
      type: 'string',
      title: 'Focus Area',
      description: 'Primary focus area of the proposal.',
      'x-format': 'dropdown',
      oneOf: [
        { const: 'education', title: 'Education' },
        { const: 'health', title: 'Health' },
        { const: 'environment', title: 'Environment' },
        { const: 'infrastructure', title: 'Infrastructure' },
      ],
    },
    strengthsSummary: {
      type: 'string',
      title: 'Key Strengths',
      description: 'Summarize the key strengths briefly.',
      'x-format': 'short-text',
    },
    overallComments: {
      type: 'string',
      title: 'Overall Comments',
      description: 'Provide detailed feedback for the proposer.',
      'x-format': 'long-text',
    },
  },
  required: [
    'innovation',
    'innovation__rationale',
    'feasibility',
    'feasibility__rationale',
    'meetsEligibility',
  ],
};
