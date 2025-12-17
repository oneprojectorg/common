/**
 * Voting schema definitions.
 * Each schema can be used directly with RJSF.
 */

import type { SelectionPipeline } from '../../services/decision/selectionPipeline/types';
import type { PhaseDefinition, VotingSchemaDefinition } from './types';

/**
 * Simple voting with linear phases:
 * submission → review → voting → results
 */
export const simpleVoting: VotingSchemaDefinition = {
  type: 'simple',
  name: 'Simple Voting',
  description: 'Basic approval voting where members vote for multiple proposals.',

  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      description: 'Members submit proposals for consideration.',
      // Typed phase behavior rules
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
      },
      // User-configurable settings, available as variables in selectionPipeline
      settings: {
        type: 'object',
        properties: {
          maxProposalsPerElector: {
            type: 'number',
            title: 'Maximum Proposals Per Elector',
            description: 'How many proposals can each member submit?',
            minimum: 1,
            default: 3,
          },
        },
        ui: {
          maxProposalsPerElector: {
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
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      description: 'Members vote on shortlisted proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: true },
      },
      // Phase-specific settings
      settings: {
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
        ui: {
          maxVotesPerElector: {
            'ui:widget': 'number',
            'ui:placeholder': '5',
          },
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
      rules: {
        proposals: { submit: false },
        voting: { submit: false },
      },
    },
  ] satisfies PhaseDefinition[],
};

export const votingTemplates: Record<string, VotingSchemaDefinition> = {
  simple: simpleVoting,
};
