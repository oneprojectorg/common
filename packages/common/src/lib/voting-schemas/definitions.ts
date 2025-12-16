/**
 * Voting schema definitions.
 * Each schema can be used directly with RJSF.
 */

import type { VotingSchemaDefinition } from './types';

export const simpleSchema: VotingSchemaDefinition = {
  schemaType: 'simple',
  name: 'Simple Voting',
  description: 'Basic approval voting where members vote for multiple proposals.',

  formSchema: {
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
};

export const advancedSchema: VotingSchemaDefinition = {
  schemaType: 'advanced',
  name: 'Advanced Voting',
  description: 'Voting with weights, delegation, and quorum.',

  formSchema: {
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
};

export const votingSchemas: Record<string, VotingSchemaDefinition> = {
  simple: simpleSchema,
  advanced: advancedSchema,
};
