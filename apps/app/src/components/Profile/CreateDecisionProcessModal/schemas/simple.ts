import { UiSchema } from '@rjsf/utils';

import { SchemaWithErrorMessage } from './types';

export const stepSchemas: {
  schema: SchemaWithErrorMessage;
  uiSchema: UiSchema;
}[] = [
  {
    schema: {
      type: 'object',
      title: 'Basic Information',
      description: 'Define the key details for your decision process.',
      required: ['processName', 'totalBudget'],
      properties: {
        processName: {
          type: 'string',
          title: 'Process Name',
          minLength: 1,
        },
        description: {
          type: 'string',
          title: 'Description',
        },
        totalBudget: {
          type: 'number',
          format: 'currency',
          title: 'Total Budget Available',
          description: 'The total amount available this funding round.',
        },
        hideBudget: {
          type: 'boolean',
          title: 'Hide budget from members',
          description:
            'When enabled, only you will see the total budget amount. Members will still see individual proposal budgets.',
        },
      },
    },
    uiSchema: {
      processName: {
        'ui:placeholder': 'e.g., 2025 Community Budget',
      },
      description: {
        'ui:widget': 'textarea',
        'ui:placeholder': 'Description for your decision-making process',
        'ui:options': {
          showToolbar: false,
        },
      },
      totalBudget: {
        'ui:widget': 'number',
        'ui:placeholder': '0',
      },
      hideBudget: {
        'ui:widget': 'checkbox',
      },
    },
  },
  {
    schema: {
      type: 'object',
      title: 'Set up your decision-making phases',
      required: [
        'ideaCollectionPhase',
        'proposalSubmissionPhase',
        'reviewShortlistingPhase',
        'votingPhase',
        'resultsAnnouncement',
      ],
      properties: {
        ideaCollectionPhase: {
          type: 'object',
          title: 'Idea Collection Phase',
          description:
            'Members share initial ideas and concepts before formal proposal submission.',
          properties: {
            ideaCollectionOpen: {
              type: 'string',
              format: 'date',
              title: 'Idea Collection Open',
            },
            ideaCollectionClose: {
              type: 'string',
              format: 'date',
              title: 'Idea Collection Close',
            },
          },
          required: ['ideaCollectionOpen', 'ideaCollectionClose'],
        },
        proposalSubmissionPhase: {
          type: 'object',
          title: 'Proposal Submission Phase',
          description:
            'Members submit proposals and ideas for funding consideration.',
          properties: {
            submissionsOpen: {
              type: 'string',
              format: 'date',
              title: 'Submissions Open',
            },
            submissionsClose: {
              type: 'string',
              format: 'date',
              title: 'Submissions Close',
            },
          },
          required: ['submissionsOpen', 'submissionsClose'],
        },
        reviewShortlistingPhase: {
          type: 'object',
          title: 'Review & Shortlisting Phase',
          description:
            'Reviewers create a shortlist of eligible proposals for voting.',
          properties: {
            reviewOpen: {
              type: 'string',
              format: 'date',
              title: 'Review Open',
            },
            reviewClose: {
              type: 'string',
              format: 'date',
              title: 'Review Close',
            },
          },
          required: ['reviewOpen', 'reviewClose'],
        },
        votingPhase: {
          type: 'object',
          title: 'Voting Phase',
          description:
            'All members vote on shortlisted proposals to decide which projects receive funding.',
          properties: {
            votingOpen: {
              type: 'string',
              format: 'date',
              title: 'Voting Open',
            },
            votingClose: {
              type: 'string',
              format: 'date',
              title: 'Voting Close',
            },
          },
          required: ['votingOpen', 'votingClose'],
        },
        resultsAnnouncement: {
          type: 'object',
          title: 'Results Announcement',
          properties: {
            resultsDate: {
              type: 'string',
              format: 'date',
              title: 'Results Announcement Date',
            },
          },
          required: ['resultsDate'],
        },
      },
    },
    uiSchema: {
      ideaCollectionPhase: {
        ideaCollectionOpen: {
          'ui:widget': 'date',
        },
        ideaCollectionClose: {
          'ui:widget': 'date',
        },
      },
      proposalSubmissionPhase: {
        submissionsOpen: {
          'ui:widget': 'date',
        },
        submissionsClose: {
          'ui:widget': 'date',
        },
      },
      reviewShortlistingPhase: {
        reviewOpen: {
          'ui:widget': 'date',
        },
        reviewClose: {
          'ui:widget': 'date',
        },
      },
      votingPhase: {
        votingOpen: {
          'ui:widget': 'date',
        },
        votingClose: {
          'ui:widget': 'date',
        },
      },
      resultsAnnouncement: {
        resultsDate: {
          'ui:widget': 'date',
        },
      },
    },
  },
  {
    schema: {
      type: 'object',
      title: 'Configure your voting settings',
      description: 'Set up how members will participate in the voting process.',
      required: ['maxVotesPerElector'],
      properties: {
        maxVotesPerElector: {
          type: 'number',
          title: 'Maximum Votes Per Member',
          minimum: 1,
          description: 'How many proposals can each member vote for?',
          errorMessage: {
            minimum: 'Must be 1 or more',
          },
        },
      },
    },
    uiSchema: {
      maxVotesPerElector: {
        'ui:widget': 'number',
        'ui:placeholder': '5',
      },
    },
  },
  {
    schema: {
      type: 'object',
      title: 'Configure proposal categories',
      description:
        'Categories help organize proposals. You can add or remove categories as needed.',
      properties: {
        categories: {
          type: 'array',
          title: 'Categories',
          items: {
            type: 'string',
          },
          default: [],
        },
      },
    },
    uiSchema: {
      categories: {
        'ui:widget': 'CategoryList',
        'ui:options': {
          addable: true,
          removable: true,
        },
      },
    },
  },
  {
    schema: {
      type: 'object',
      title: 'Configure proposal information',
      description:
        'Set up information that will be displayed to participants when they create proposals.',
      properties: {
        proposalInfoTitle: {
          type: 'string',
          title: 'Information Title',
          description:
            'Title for the information modal shown to proposal creators',
        },
        proposalInfoContent: {
          type: 'string',
          title: 'Information Content',
          description:
            'Information that will be displayed to participants when they create a new proposal',
        },
      },
    },
    uiSchema: {
      proposalInfoTitle: {
        'ui:placeholder': 'e.g., Proposal Guidelines',
      },
      proposalInfoContent: {
        'ui:widget': 'RichTextEditor',
        'ui:placeholder':
          'Enter information that will help participants understand the requirements and guidelines for creating proposals...',
        'ui:options': {
          className: 'min-h-72',
        },
      },
    },
  },
  {
    schema: {
      type: 'object',
      title: 'Setup proposal template',
      description: 'Configure guidance and budget limits',
      required: ['budgetCapAmount'],
      properties: {
        budgetCapAmount: {
          type: 'number',
          format: 'currency',
          title: 'Budget cap amount',
          minimum: 0,
          description: 'Maximum budget amount participants can request',
          errorMessage: {
            type: 'Please enter an amount',
            minimum: 'Must be 0 or more',
          },
        },
        descriptionGuidance: {
          type: 'string',
          title: 'Description guidance',
          description:
            'Placeholder text that appears in the proposal description area.',
        },
        requireBudget: {
          type: 'boolean',
          title: 'Require budget for proposals',
          description:
            'When enabled, all proposals must include a budget amount',
        },
      },
    },
    uiSchema: {
      budgetCapAmount: {
        'ui:widget': 'number',
        'ui:placeholder': '0',
      },
      descriptionGuidance: {
        'ui:widget': 'RichTextEditor',
        'ui:placeholder':
          "e.g., Start with the problem you're addressing, explain your solution, and describe the expected impact on our community.",
        'ui:options': {
          className: 'min-h-72',
        },
      },
      requireBudget: {
        'ui:widget': 'checkbox',
      },
    },
  },
];

export const schemaDefaults = {
  processName: '',
  description: '',
  totalBudget: null,
  hideBudget: false,
  ideaCollectionPhase: {
    ideaCollectionOpen: '',
    ideaCollectionClose: '',
  },
  proposalSubmissionPhase: {
    submissionsOpen: '',
    submissionsClose: '',
  },
  reviewShortlistingPhase: {
    reviewOpen: '',
    reviewClose: '',
  },
  votingPhase: {
    votingOpen: '',
    votingClose: '',
  },
  resultsAnnouncement: {
    resultsDate: '',
  },
  maxVotesPerElector: null,
  categories: [],
  proposalInfoTitle: '',
  proposalInfoContent: '',
  budgetCapAmount: null,
  descriptionGuidance: '',
  requireBudget: true,
};

// Transform form data to API-compatible format
export const transformFormDataToProcessSchema = (
  data: Record<string, unknown>,
) => {
  return {
    name: data.processName as string,
    description: data.description as string,
    budget: data.totalBudget as number,
    fields: {
      categories: data.categories,
      proposalInfoTitle: data.proposalInfoTitle,
      proposalInfoContent: data.proposalInfoContent,
      budgetCapAmount: data.budgetCapAmount,
      descriptionGuidance: data.descriptionGuidance,
    },
    states: [
      {
        id: 'ideaCollection',
        name: 'Idea Collection',
        type: 'initial' as const,
        phase: {
          startDate: (data.ideaCollectionPhase as any)?.ideaCollectionOpen,
          endDate: (data.ideaCollectionPhase as any)?.ideaCollectionClose,
          sortOrder: 1,
        },
        config: {
          allowProposals: false,
          allowDecisions: false,
        },
      },
      {
        id: 'submission',
        name: 'Proposal Submission',
        type: 'intermediate' as const,
        phase: {
          startDate: (data.proposalSubmissionPhase as any)?.submissionsOpen,
          endDate: (data.proposalSubmissionPhase as any)?.submissionsClose,
          sortOrder: 2,
        },
        config: {
          allowProposals: true,
          allowDecisions: false,
        },
      },
      {
        id: 'review',
        name: 'Review & Shortlisting',
        type: 'intermediate' as const,
        phase: {
          startDate: (data.reviewShortlistingPhase as any)?.reviewOpen,
          endDate: (data.reviewShortlistingPhase as any)?.reviewClose,
          sortOrder: 3,
        },
        config: {
          allowProposals: false,
          allowDecisions: false,
          allowShortlisting: true,
        },
      },
      {
        id: 'voting',
        name: 'Voting',
        type: 'intermediate' as const,
        phase: {
          startDate: (data.votingPhase as any)?.votingOpen,
          endDate: (data.votingPhase as any)?.votingClose,
          sortOrder: 4,
        },
        config: {
          allowProposals: false,
          allowDecisions: true,
        },
      },
      {
        id: 'results',
        name: 'Results',
        type: 'final' as const,
        phase: {
          startDate: (data.resultsAnnouncement as any)?.resultsDate,
          sortOrder: 5,
        },
        config: {
          allowProposals: false,
          allowDecisions: false,
        },
      },
    ],
    transitions: [
      {
        id: 'ideaCollection-to-submission',
        name: 'Move to Proposal Submission',
        from: 'ideaCollection',
        to: 'submission',
        rules: { type: 'manual' as const },
      },
      {
        id: 'submission-to-review',
        name: 'Move to Review',
        from: 'submission',
        to: 'review',
        rules: { type: 'manual' as const },
      },
      {
        id: 'review-to-voting',
        name: 'Move to Voting',
        from: 'review',
        to: 'voting',
        rules: { type: 'manual' as const },
      },
      {
        id: 'voting-to-results',
        name: 'Move to Results',
        from: 'voting',
        to: 'results',
        rules: { type: 'manual' as const },
      },
    ],
    initialState: 'ideaCollection',
    decisionDefinition: {
      type: 'object',
      properties: {
        vote: { type: 'boolean' },
        maxVotesPerElector: data.maxVotesPerElector,
      },
    },
    proposalTemplate: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        budget: { type: 'number', maximum: data.budgetCapAmount },
        ...(data.categories && (data.categories as string[]).length > 0
          ? {
              category: {
                type: ['string', 'null'],
                enum: [...(data.categories as string[]), null],
              },
            }
          : {}),
      },
      required: data.requireBudget
        ? ['title', 'description', 'budget']
        : ['title', 'description'],
    },
  };
};
