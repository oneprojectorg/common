/**
 * Voting schema definitions.
 * Each schema can be used directly with RJSF.
 */

import type { SelectionPipeline } from '../../services/decision/selectionPipeline/types';
import type { VotingSchemaDefinition } from './types';

export const simpleSchema: VotingSchemaDefinition = {
  schemaType: 'simple',
  name: 'Simple Voting',
  description: 'Basic approval voting where members vote for multiple proposals.',

  process: {
    type: 'object',
    required: ['maxVotesPerMember'],
    properties: {
      maxVotesPerMember: {
        type: 'number',
        title: 'Maximum Votes Per Member',
        description: 'How many proposals can each member vote for?',
        minimum: 1,
      },
    },
  },

  uiSchema: {
    maxVotesPerMember: {
      'ui:widget': 'number',
      'ui:placeholder': '5',
    },
  },

  defaults: {
    maxVotesPerMember: 3,
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
        count: { variable: '$maxVotesPerMember' },
      },
    ],
  } satisfies SelectionPipeline,
};

export const advancedSchema: VotingSchemaDefinition = {
  schemaType: 'advanced',
  name: 'Advanced Voting',
  description: 'Voting with weights, delegation, and quorum.',

  process: {
    type: 'object',
    required: ['maxVotesPerMember'],
    properties: {
      maxVotesPerMember: {
        type: 'number',
        title: 'Maximum Votes Per Member',
        description: 'How many proposals can each member vote for?',
        minimum: 1,
      },
      weightedVoting: {
        type: 'boolean',
        title: 'Enable Weighted Voting',
        description: 'Votes have different weights based on member roles.',
      },
      allowDelegation: {
        type: 'boolean',
        title: 'Allow Vote Delegation',
        description: 'Members can delegate their votes to others.',
      },
      quorumPercentage: {
        type: 'number',
        title: 'Quorum Percentage',
        description: 'Minimum participation required for valid results.',
        minimum: 0,
        maximum: 100,
      },
    },
  },

  uiSchema: {
    maxVotesPerMember: {
      'ui:widget': 'number',
      'ui:placeholder': '5',
    },
    weightedVoting: {
      'ui:widget': 'checkbox',
    },
    allowDelegation: {
      'ui:widget': 'checkbox',
    },
    quorumPercentage: {
      'ui:widget': 'number',
      'ui:placeholder': '50',
    },
  },

  defaults: {
    maxVotesPerMember: 5,
    weightedVoting: false,
    allowDelegation: false,
    quorumPercentage: null,
  },

  selectionPipeline: {
    version: '1.0.0',
    blocks: [
      {
        id: 'check-quorum',
        type: 'filter',
        name: 'Filter proposals meeting quorum',
        condition: {
          operator: 'greaterThanOrEquals',
          left: { field: 'voteData.participationRate' },
          right: { variable: '$quorumPercentage' },
        },
      },
      {
        id: 'calculate-score',
        type: 'score',
        name: 'Calculate weighted score',
        scoreField: 'metadata.finalScore',
        formula: [
          { field: 'voteData.likesCount', weight: 0.5, normalize: true },
          { field: 'voteData.followsCount', weight: 0.3, normalize: true },
          { field: 'voteData.approvalRate', weight: 0.2, normalize: true },
        ],
      },
      {
        id: 'sort-by-score',
        type: 'sort',
        name: 'Sort by weighted score',
        sortBy: [{ field: 'metadata.finalScore', order: 'desc' }],
      },
      {
        id: 'limit-results',
        type: 'limit',
        name: 'Take top N results',
        count: { variable: '$maxVotesPerMember' },
      },
    ],
  } satisfies SelectionPipeline,
};

export const votingSchemas: Record<string, VotingSchemaDefinition> = {
  simple: simpleSchema,
  advanced: advancedSchema,
};
