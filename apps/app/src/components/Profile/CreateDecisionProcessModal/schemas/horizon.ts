import { RJSFSchema, UiSchema } from '@rjsf/utils';

export const stepSchemas: { schema: RJSFSchema; uiSchema: UiSchema }[] = [
  {
    schema: {
      type: 'object',
      title: 'Basic Information',
      description:
        'Define the key details for your Horizon Fund decision process.',
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
        'ui:placeholder': 'e.g., Our Fund',
      },
      description: {
        'ui:widget': 'RichTextEditor',
        'ui:placeholder': 'Description for your decision-making process',
        'ui:options': {
          showToolbar: true,
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
      title: 'Set up your Horizon Fund dates',
      required: [
        'proposalSubmissionPhase',
        'communityVotingPhase',
        'committeeDeliberationPhase',
        'resultsPhase',
      ],
      properties: {
        proposalSubmissionPhase: {
          type: 'object',
          title: 'Proposal Submission',
          description: 'Members submit proposals for funding consideration.',
          properties: {
            submissionsOpen: {
              type: 'string',
              format: 'date',
              title: 'Submissions Open',
              default: '2025-09-08',
            },
            submissionsClose: {
              type: 'string',
              format: 'date',
              title: 'Submissions Close',
              default: '2025-10-08',
            },
            hideSubmitButton: {
              type: 'boolean',
              title: 'Hide Submit Proposal Button',
              description:
                'When enabled, the submit proposal button will be hidden during this phase.',
              default: false,
            },
          },
          required: ['submissionsOpen', 'submissionsClose'],
        },
        communityVotingPhase: {
          type: 'object',
          title: 'Community Voting',
          description: 'Community members vote on submitted proposals.',
          properties: {
            votingOpen: {
              type: 'string',
              format: 'date',
              title: 'Voting Open',
              default: '2025-10-13',
            },
            votingClose: {
              type: 'string',
              format: 'date',
              title: 'Voting Close',
              default: '2025-10-24',
            },
          },
          required: ['votingOpen', 'votingClose'],
        },
        committeeDeliberationPhase: {
          type: 'object',
          title: 'Committee Deliberation',
          description:
            'Committee reviews community votes and makes final decisions.',
          properties: {
            deliberationStart: {
              type: 'string',
              format: 'date',
              title: 'Deliberation Start',
              default: '2025-10-13',
            },
            deliberationEnd: {
              type: 'string',
              format: 'date',
              title: 'Deliberation End',
              default: '2025-10-30',
            },
          },
          required: ['deliberationStart', 'deliberationEnd'],
        },
        resultsPhase: {
          type: 'object',
          title: 'Results',
          description: 'Final results are announced.',
          properties: {
            resultsDate: {
              type: 'string',
              format: 'date',
              title: 'Results Announcement Date',
              default: '2025-11-15',
            },
          },
          required: ['resultsDate'],
        },
      },
    },
    uiSchema: {
      proposalSubmissionPhase: {
        submissionsOpen: {
          'ui:widget': 'date',
        },
        submissionsClose: {
          'ui:widget': 'date',
        },
        hideSubmitButton: {
          'ui:widget': 'checkbox',
        },
      },
      communityVotingPhase: {
        votingOpen: {
          'ui:widget': 'date',
        },
        votingClose: {
          'ui:widget': 'date',
        },
      },
      committeeDeliberationPhase: {
        deliberationStart: {
          'ui:widget': 'date',
        },
        deliberationEnd: {
          'ui:widget': 'date',
        },
      },
      resultsPhase: {
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
      description:
        'Set up how community members will participate in the voting process.',
      required: ['maxVotesPerMember'],
      properties: {
        maxVotesPerMember: {
          type: 'number',
          title: 'Maximum Votes Per Member',
          minimum: 1,
          description: 'How many proposals can each member vote for?',
        },
      },
    },
    uiSchema: {
      maxVotesPerMember: {
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
  proposalSubmissionPhase: {
    submissionsOpen: '2024-09-08',
    submissionsClose: '2024-10-08',
    hideSubmitButton: false,
  },
  communityVotingPhase: {
    votingOpen: '2024-10-13',
    votingClose: '2024-10-24',
  },
  committeeDeliberationPhase: {
    deliberationStart: '2024-10-25',
    deliberationEnd: '2024-11-08',
  },
  resultsPhase: {
    resultsDate: '2024-11-15',
  },
  maxVotesPerMember: null,
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
    states: (() => {
      const hideSubmitButton = (data.proposalSubmissionPhase as any)
        ?.hideSubmitButton;
      const allowProposals = !hideSubmitButton;

      return [
        {
          id: 'proposalSubmission',
          name: 'Proposal Submission',
          type: 'initial' as const,
          phase: {
            startDate: (data.proposalSubmissionPhase as any)?.submissionsOpen,
            endDate: (data.proposalSubmissionPhase as any)?.submissionsClose,
            sortOrder: 1,
          },
          config: {
            allowProposals: allowProposals,
            allowDecisions: false,
          },
        },
        {
          id: 'communityVoting',
          name: 'Community Voting',
          type: 'intermediate' as const,
          phase: {
            startDate: (data.communityVotingPhase as any)?.votingOpen,
            endDate: (data.communityVotingPhase as any)?.votingClose,
            sortOrder: 2,
          },
          config: {
            allowProposals: false,
            allowDecisions: true,
          },
        },
        {
          id: 'committeeDeliberation',
          name: 'Committee Deliberation',
          type: 'intermediate' as const,
          phase: {
            startDate: (data.committeeDeliberationPhase as any)
              ?.deliberationStart,
            endDate: (data.committeeDeliberationPhase as any)?.deliberationEnd,
            sortOrder: 3,
          },
          config: {
            allowProposals: false,
            allowDecisions: false,
          },
        },
        {
          id: 'results',
          name: 'Results',
          type: 'final' as const,
          phase: {
            startDate: (data.resultsPhase as any)?.resultsDate,
            sortOrder: 4,
          },
          config: {
            allowProposals: false,
            allowDecisions: false,
          },
        },
      ];
    })(),
    transitions: [
      {
        id: 'proposalSubmission-to-communityVoting',
        name: 'Move to Community Voting',
        from: 'proposalSubmission',
        to: 'communityVoting',
        rules: { type: 'manual' as const },
      },
      {
        id: 'communityVoting-to-committeeDeliberation',
        name: 'Move to Committee Deliberation',
        from: 'communityVoting',
        to: 'committeeDeliberation',
        rules: { type: 'manual' as const },
      },
      {
        id: 'committeeDeliberation-to-results',
        name: 'Move to Results',
        from: 'committeeDeliberation',
        to: 'results',
        rules: { type: 'manual' as const },
      },
    ],
    initialState: 'proposalSubmission',
    decisionDefinition: {
      type: 'object',
      properties: {
        vote: { type: 'boolean' },
        maxVotesPerMember: data.maxVotesPerMember,
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
