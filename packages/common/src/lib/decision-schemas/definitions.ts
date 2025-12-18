/**
 * Decision schema definitions.
 * Each schema can be used directly with RJSF.
 */
import type { SelectionPipeline } from '../../services/decision/selectionPipeline/types';
import type { DecisionSchemaDefinition, PhaseDefinition } from './types';

/**
 * Simple voting with linear phases:
 * submission → review → voting → results
 */
export const simpleVoting: DecisionSchemaDefinition = {
  id: 'simple',
  version: '1.0.0',
  name: 'Simple Voting',
  description:
    'Basic approval voting where members vote for multiple proposals.',

  phases: [
    {
      id: 'submission',
      name: 'Proposal Submission',
      description: 'Members submit proposals for consideration.',
      // Typed phase behavior rules
      rules: {
        proposals: { submit: true },
        voting: { submit: false },
        progression: { method: 'date', start: '2026-01-01' },
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
        progression: { method: 'date', start: '2026-01-02' },
      },
    },
    {
      id: 'voting',
      name: 'Voting',
      description: 'Members vote on shortlisted proposals.',
      rules: {
        proposals: { submit: false },
        voting: { submit: true },
        progression: { method: 'date', start: '2026-01-03' },
      },
      // Phase-specific settings
      settings: {
        type: 'object',
        required: ['maxVotesPerMember'],
        properties: {
          maxVotesPerMember: {
            type: 'number',
            title: 'Maximum Votes Per Member',
            description: 'How many proposals can each member vote for?',
            minimum: 1,
            default: 3,
          },
        },
        ui: {
          maxVotesPerMember: {
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
            name: 'Take top N (based on maxVotesPerMember config)',
            count: { variable: '$maxVotesPerMember' },
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
        progression: { method: 'date', start: '2026-01-04' },
      },
    },
  ] satisfies PhaseDefinition[],
};

export const decisionTemplates: Record<string, DecisionSchemaDefinition> = {
  simple: simpleVoting,
};
