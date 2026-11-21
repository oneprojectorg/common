import { reviewRubric } from './reviewRubric';
import type { ProcessAdminFixture } from './types';

/** A launched process in its second phase: five dated phases, one current. */
export const liveFixture: ProcessAdminFixture = {
  name: 'live',
  isOpen: true,
  phases: [
    {
      id: '5b7e1a40-2c8f-4d3b-8e9a-000000000001',
      isCurrent: false,
      sortOrder: 0,
      name: 'Call for ideas',
      description:
        'Residents submitted 42 project ideas for the neighbourhood fund.',
      startDate: '2026-09-07T04:00:00.000Z',
      endDate: '2026-09-28T04:00:00.000Z',
      rules: {
        proposals: { submit: true, edit: true },
        advancement: { method: 'date' },
      },
    },
    {
      id: '5b7e1a40-2c8f-4d3b-8e9a-000000000002',
      isCurrent: true,
      sortOrder: 1,
      name: 'Refine proposals',
      description:
        'Authors answer questions from the steering group and update their budgets.',
      startDate: '2026-09-28T04:00:00.000Z',
      endDate: '2026-11-16T05:00:00.000Z',
      rules: {
        proposals: { submit: false, edit: true },
        advancement: { method: 'date' },
      },
    },
    {
      id: '5b7e1a40-2c8f-4d3b-8e9a-000000000003',
      isCurrent: false,
      sortOrder: 2,
      name: 'Review',
      description:
        'Invited reviewers score each proposal against the rubric. Scores are hidden until voting opens.',
      startDate: '2026-11-16T05:00:00.000Z',
      endDate: '2026-12-07T05:00:00.000Z',
      rules: {
        proposals: { submit: false, edit: false },
        reviews: { submit: true },
        advancement: { method: 'date' },
      },
      rubricTemplate: reviewRubric,
    },
    {
      id: '5b7e1a40-2c8f-4d3b-8e9a-000000000004',
      isCurrent: false,
      sortOrder: 3,
      name: 'Community vote',
      description: 'Members pick up to three proposals to fund.',
      startDate: '2026-12-07T05:00:00.000Z',
      endDate: '2026-12-21T05:00:00.000Z',
      rules: {
        proposals: { submit: false, edit: false },
        voting: { submit: true, edit: true, maxVotesPerMember: 3 },
        advancement: { method: 'date' },
      },
    },
    {
      id: '5b7e1a40-2c8f-4d3b-8e9a-000000000005',
      isCurrent: false,
      sortOrder: 4,
      name: 'Results',
      description: 'Funded proposals are announced and the fund is allocated.',
      startDate: '2026-12-21T05:00:00.000Z',
      rules: {
        proposals: { submit: false, edit: false },
        advancement: { method: 'manual' },
      },
    },
  ],
};
