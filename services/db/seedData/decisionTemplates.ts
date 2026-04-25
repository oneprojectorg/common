/**
 * Decision process templates for seed scripts.
 *
 * Mirrors the canonical templates in
 * `packages/common/src/services/decision/schemas/definitions.ts`. We keep a copy
 * here so that seed scripts in `@op/db` can populate the `decision_processes`
 * table without depending on `@op/common` (which itself depends on `@op/db`,
 * so an import would be circular).
 */

export const simpleVoting = {
  id: 'simple',
  version: '1.0.0',
  name: 'Simple Voting',
  description:
    'Basic approval voting where members vote for multiple proposals.',

  proposalTemplate: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        title: 'Proposal title',
        'x-format': 'short-text',
      },
      summary: {
        type: 'string',
        title: 'Proposal summary',
        'x-format': 'long-text',
      },
      budget: {
        type: 'object',
        title: 'Budget',
        'x-format': 'money',
        properties: {
          amount: { type: 'number' },
          currency: { type: 'string', default: 'USD' },
        },
      },
    },
    'x-field-order': ['title', 'budget', 'summary'],
    required: ['title', 'summary'],
  },

  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      description: 'Members submit proposals for consideration.',
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        advancement: { method: 'date', endDate: '2026-01-01' },
      },
      settings: {
        type: 'object',
        properties: {
          budget: {
            type: 'number',
            title: 'Budget',
            description: 'Total budget available for this decision process',
            minimum: 0,
          },
          maxProposalsPerMember: {
            type: 'number',
            title: 'Maximum Proposals Per Member',
            description: 'How many proposals can each member submit?',
            minimum: 1,
            default: 3,
          },
        },
        ui: {
          budget: { 'ui:widget': 'number', 'ui:placeholder': '100000' },
          maxProposalsPerMember: {
            'ui:widget': 'number',
            'ui:placeholder': '3',
          },
        },
      },
    },
    {
      id: 'review',
      name: 'Review & Shortlist',
      description: 'Reviewers evaluate and shortlist proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'date', endDate: '2026-01-02' },
      },
      settings: {
        type: 'object',
        properties: {
          budget: {
            type: 'number',
            title: 'Budget',
            description: 'Total budget available for this decision process',
            minimum: 0,
          },
        },
        ui: {
          budget: { 'ui:widget': 'number', 'ui:placeholder': '100000' },
        },
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      description: 'Members vote on shortlisted proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: true },
        advancement: { method: 'date', endDate: '2026-01-03' },
      },
      settings: {
        type: 'object',
        required: ['maxVotesPerMember'],
        properties: {
          budget: {
            type: 'number',
            title: 'Budget',
            description: 'Total budget available for this decision process',
            minimum: 0,
          },
          maxVotesPerMember: {
            type: 'number',
            title: 'Maximum Votes Per Member',
            description: 'How many proposals can each member vote for?',
            minimum: 1,
            default: 3,
          },
        },
        ui: {
          budget: { 'ui:widget': 'number', 'ui:placeholder': '100000' },
          maxVotesPerMember: {
            'ui:widget': 'number',
            'ui:placeholder': '5',
          },
        },
      },
      selectionPipeline: {
        version: '1.0.0',
        blocks: [
          {
            id: 'sort-by-likes',
            type: 'sort',
            name: 'Sort by likes count',
            sortBy: [{ field: 'voteData.likesCount', order: 'desc' }],
          },
          {
            id: 'limit-by-votes',
            type: 'limit',
            name: 'Take top N (based on maxVotesPerMember config)',
            count: { variable: 'maxVotesPerMember' },
          },
        ],
      },
    },
    {
      id: 'results',
      name: 'Results',
      description: 'View final results and winning proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
        advancement: { method: 'date', endDate: '2026-01-04' },
      },
      settings: {
        type: 'object',
        properties: {
          budget: {
            type: 'number',
            title: 'Budget',
            description: 'Total budget available for this decision process',
            minimum: 0,
          },
        },
        ui: {
          budget: { 'ui:widget': 'number', 'ui:placeholder': '100000' },
        },
      },
    },
  ],
};

export const decisionTemplates = {
  simple: simpleVoting,
};
