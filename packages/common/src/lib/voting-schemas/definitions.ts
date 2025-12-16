/**
 * JSON-based voting schema definitions using RJSF-compatible format.
 *
 * Each schema defines:
 * - formSchema: JSON Schema for validation
 * - uiSchema: RJSF UI schema for rendering
 * - defaults: Default form values
 * - bindings: Maps form fields to process schema locations
 */

import type { VotingSchemaDefinition } from './types';

/**
 * Simple voting schema - basic approval voting with max votes limit
 */
export const simpleSchema: VotingSchemaDefinition = {
  schemaType: 'simple',
  name: 'Simple Voting',
  description: 'Basic approval voting where members can vote for multiple proposals up to a limit.',

  formSchema: {
    type: 'object',
    title: 'Configure Voting Settings',
    description: 'Set up how members will participate in the voting process.',
    required: ['maxVotesPerMember'],
    properties: {
      maxVotesPerMember: {
        type: 'number',
        title: 'Maximum Votes Per Member',
        description: 'How many proposals can each member vote for?',
        minimum: 1,
        errorMessage: {
          minimum: 'Must be 1 or more',
        },
      },
      allowProposals: {
        type: 'boolean',
        title: 'Allow Proposals',
        description: 'Enable members to submit proposals during this phase.',
      },
      allowDecisions: {
        type: 'boolean',
        title: 'Allow Voting',
        description: 'Enable members to vote on proposals during this phase.',
      },
    },
  },

  uiSchema: {
    maxVotesPerMember: {
      'ui:widget': 'number',
      'ui:placeholder': '5',
    },
    allowProposals: {
      'ui:widget': 'checkbox',
    },
    allowDecisions: {
      'ui:widget': 'checkbox',
    },
  },

  defaults: {
    maxVotesPerMember: 3,
    allowProposals: true,
    allowDecisions: true,
  },

  bindings: {
    maxVotesPerMember: {
      target: 'instanceData.fieldValues.maxVotesPerMember',
    },
    allowProposals: {
      target: 'states.$.config.allowProposals',
      transform: 'stateConfig',
    },
    allowDecisions: {
      target: 'states.$.config.allowDecisions',
      transform: 'stateConfig',
    },
  },
};

/**
 * Advanced voting schema - supports weighted voting, delegation, and quorum
 */
export const advancedSchema: VotingSchemaDefinition = {
  schemaType: 'advanced',
  name: 'Advanced Voting',
  description: 'Advanced voting with weighted votes, delegation, and quorum requirements.',

  formSchema: {
    type: 'object',
    title: 'Configure Advanced Voting Settings',
    description: 'Set up advanced voting options including weights, delegation, and quorum.',
    required: ['maxVotesPerMember'],
    properties: {
      maxVotesPerMember: {
        type: 'number',
        title: 'Maximum Votes Per Member',
        description: 'How many proposals can each member vote for?',
        minimum: 1,
        errorMessage: {
          minimum: 'Must be 1 or more',
        },
      },
      allowProposals: {
        type: 'boolean',
        title: 'Allow Proposals',
        description: 'Enable members to submit proposals during this phase.',
      },
      allowDecisions: {
        type: 'boolean',
        title: 'Allow Voting',
        description: 'Enable members to vote on proposals during this phase.',
      },
      weightedVoting: {
        type: 'boolean',
        title: 'Enable Weighted Voting',
        description: 'Allow votes to have different weights based on member roles or token holdings.',
      },
      allowDelegation: {
        type: 'boolean',
        title: 'Allow Vote Delegation',
        description: 'Allow members to delegate their voting power to others.',
      },
      quorumPercentage: {
        type: 'number',
        title: 'Quorum Percentage',
        description: 'Minimum percentage of eligible voters required to participate for the vote to be valid.',
        minimum: 0,
        maximum: 100,
        errorMessage: {
          minimum: 'Must be 0 or more',
          maximum: 'Cannot exceed 100',
        },
      },
    },
  },

  uiSchema: {
    maxVotesPerMember: {
      'ui:widget': 'number',
      'ui:placeholder': '5',
    },
    allowProposals: {
      'ui:widget': 'checkbox',
    },
    allowDecisions: {
      'ui:widget': 'checkbox',
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
      'ui:options': {
        suffix: '%',
      },
    },
  },

  defaults: {
    maxVotesPerMember: 5,
    allowProposals: true,
    allowDecisions: true,
    weightedVoting: false,
    allowDelegation: false,
    quorumPercentage: null,
  },

  bindings: {
    maxVotesPerMember: {
      target: 'instanceData.fieldValues.maxVotesPerMember',
    },
    allowProposals: {
      target: 'states.$.config.allowProposals',
      transform: 'stateConfig',
    },
    allowDecisions: {
      target: 'states.$.config.allowDecisions',
      transform: 'stateConfig',
    },
    weightedVoting: {
      target: 'instanceData.fieldValues.weightedVoting',
    },
    allowDelegation: {
      target: 'instanceData.fieldValues.allowDelegation',
    },
    quorumPercentage: {
      target: 'instanceData.fieldValues.quorumPercentage',
    },
  },
};

/**
 * Default schema - fallback when no specific schema type matches
 */
export const defaultSchema: VotingSchemaDefinition = {
  schemaType: 'default',
  name: 'Default Voting',
  description: 'Standard voting configuration.',

  formSchema: {
    type: 'object',
    title: 'Configure Voting Settings',
    required: ['maxVotesPerMember'],
    properties: {
      maxVotesPerMember: {
        type: 'number',
        title: 'Maximum Votes Per Member',
        description: 'How many proposals can each member vote for?',
        minimum: 1,
      },
      allowProposals: {
        type: 'boolean',
        title: 'Allow Proposals',
      },
      allowDecisions: {
        type: 'boolean',
        title: 'Allow Voting',
      },
    },
  },

  uiSchema: {
    maxVotesPerMember: {
      'ui:widget': 'number',
      'ui:placeholder': '5',
    },
    allowProposals: {
      'ui:widget': 'checkbox',
    },
    allowDecisions: {
      'ui:widget': 'checkbox',
    },
  },

  defaults: {
    maxVotesPerMember: 3,
    allowProposals: true,
    allowDecisions: true,
  },

  bindings: {
    maxVotesPerMember: {
      target: 'instanceData.fieldValues.maxVotesPerMember',
    },
    allowProposals: {
      target: 'states.$.config.allowProposals',
      transform: 'stateConfig',
    },
    allowDecisions: {
      target: 'states.$.config.allowDecisions',
      transform: 'stateConfig',
    },
  },
};

/**
 * All registered schema definitions
 */
export const votingSchemaDefinitions: VotingSchemaDefinition[] = [
  simpleSchema,
  advancedSchema,
  defaultSchema,
];
