import { reviewRubric } from './reviewRubric';
import type { ProcessAdminFixture } from './types';

/** A process that has not launched: four phases, two still undated, no current phase. */
export const draftFixture: ProcessAdminFixture = {
  name: 'draft',
  isOpen: false,
  phases: [
    {
      id: '0f3c9c2e-6d2a-4b6e-9a51-000000000001',
      isCurrent: false,
      sortOrder: 0,
      name: 'Call for ideas',
      description:
        'Residents submit project ideas for the neighbourhood fund. Anyone with an account can submit one idea.',
      startDate: '2026-11-02T05:00:00.000Z',
      endDate: '2026-11-20T05:00:00.000Z',
      rules: {
        proposals: { submit: true, edit: true },
        advancement: { method: 'date' },
      },
    },
    {
      id: '0f3c9c2e-6d2a-4b6e-9a51-000000000002',
      isCurrent: false,
      sortOrder: 1,
      name: 'Refine proposals',
      description:
        'Authors answer questions from the steering group and update their budgets.',
      rules: {
        proposals: { submit: false, edit: true },
        advancement: { method: 'manual' },
      },
    },
    {
      id: '0f3c9c2e-6d2a-4b6e-9a51-000000000003',
      isCurrent: false,
      sortOrder: 2,
      name: 'Review',
      description:
        'Invited reviewers score each proposal against the rubric. Scores are hidden until voting opens.',
      rules: {
        proposals: { submit: false, edit: false },
        reviews: { submit: true },
        advancement: { method: 'manual' },
      },
      rubricTemplate: reviewRubric,
    },
    {
      id: '0f3c9c2e-6d2a-4b6e-9a51-000000000004',
      isCurrent: false,
      sortOrder: 3,
      name: 'Community vote',
      description: 'Members pick up to three proposals to fund.',
      rules: {
        proposals: { submit: false, edit: false },
        voting: { submit: true, edit: true, maxVotesPerMember: 3 },
        advancement: { method: 'date' },
      },
    },
  ],
};
