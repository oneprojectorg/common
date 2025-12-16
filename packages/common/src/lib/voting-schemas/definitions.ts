/**
 * Voting schema definitions.
 * Each schema can be used directly with RJSF.
 */

import type { SelectionPipeline } from '../../services/decision/selectionPipeline/types';
import type { PhaseDefinition, VotingSchemaDefinition } from './types';

/**
 * Simple voting schema with linear phases:
 * submission → review → voting → results
 */
export const simpleSchema: VotingSchemaDefinition = {
  schemaType: 'simple',
  name: 'Simple Voting',
  description: 'Basic approval voting where members vote for multiple proposals.',

  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      description: 'Members submit proposals for consideration.',
      config: {
        allowProposals: true,
        allowDecisions: false,
      },
    },
    {
      id: 'review',
      name: 'Review & Shortlist',
      description: 'Reviewers evaluate and shortlist proposals.',
      config: {
        allowProposals: false,
        allowDecisions: false,
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      description: 'Members vote on shortlisted proposals.',
      config: {
        allowProposals: false,
        allowDecisions: true,
      },
      // Phase-specific configuration
      configSchema: {
        type: 'object',
        required: ['maxVotesPerElector'],
        properties: {
          maxVotesPerElector: {
            type: 'number',
            title: 'Maximum Votes Per Elector',
            description: 'How many proposals can each member vote for?',
            minimum: 1,
            default: 3,
          },
        },
      },
      configUiSchema: {
        maxVotesPerElector: {
          'ui:widget': 'number',
          'ui:placeholder': '5',
        },
      },
      // Selection pipeline: sort by likes, take top N
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
            name: 'Take top N (based on maxVotesPerElector config)',
            count: { variable: '$maxVotesPerElector' },
          },
        ],
      } satisfies SelectionPipeline,
    },
    {
      id: 'results',
      name: 'Results',
      description: 'View final results and winning proposals.',
      config: {
        allowProposals: false,
        allowDecisions: false,
      },
    },
  ] satisfies PhaseDefinition[],
};

/**
 * Advanced voting schema with weighted scoring, quorum, and delegation.
 */
export const advancedSchema: VotingSchemaDefinition = {
  schemaType: 'advanced',
  name: 'Advanced Voting',
  description: 'Voting with weights, delegation, and quorum.',

  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      description: 'Members submit proposals for consideration.',
      config: {
        allowProposals: true,
        allowDecisions: false,
      },
    },
    {
      id: 'review',
      name: 'Review & Shortlist',
      description: 'Reviewers evaluate and shortlist proposals.',
      config: {
        allowProposals: false,
        allowDecisions: false,
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      description: 'Members vote on shortlisted proposals with advanced options.',
      config: {
        allowProposals: false,
        allowDecisions: true,
      },
      // Phase-specific configuration for advanced voting
      configSchema: {
        type: 'object',
        required: ['maxVotesPerElector'],
        properties: {
          maxVotesPerElector: {
            type: 'number',
            title: 'Maximum Votes Per Elector',
            description: 'How many proposals can each member vote for?',
            minimum: 1,
            default: 5,
          },
          weightedVoting: {
            type: 'boolean',
            title: 'Enable Weighted Voting',
            description: 'Votes have different weights based on member roles.',
            default: false,
          },
          allowDelegation: {
            type: 'boolean',
            title: 'Allow Vote Delegation',
            description: 'Members can delegate their votes to others.',
            default: false,
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
      configUiSchema: {
        maxVotesPerElector: {
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
      // Selection pipeline: filter by quorum, score, sort, limit
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
            count: { variable: '$maxVotesPerElector' },
          },
        ],
      } satisfies SelectionPipeline,
    },
    {
      id: 'results',
      name: 'Results',
      description: 'View final results and winning proposals.',
      config: {
        allowProposals: false,
        allowDecisions: false,
      },
    },
  ] satisfies PhaseDefinition[],
};

export const votingSchemas: Record<string, VotingSchemaDefinition> = {
  simple: simpleSchema,
  advanced: advancedSchema,
};
