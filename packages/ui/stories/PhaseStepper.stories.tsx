import type { Meta, StoryObj } from '@storybook/react-vite';

import { PhaseStepper } from '../src/components/PhaseStepper';

const meta: Meta<typeof PhaseStepper> = {
  title: 'PhaseStepper',
  component: PhaseStepper,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    currentPhaseId: {
      control: 'select',
      options: ['phase-1', 'phase-2', 'phase-3', 'phase-4'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    phases: [
      {
        id: 'phase-1',
        name: 'Planning',
        sortOrder: 1,
      },
      {
        id: 'phase-2',
        name: 'Design',
        sortOrder: 2,
      },
      {
        id: 'phase-3',
        name: 'Development',
        sortOrder: 3,
      },
      {
        id: 'phase-4',
        name: 'Testing',
        sortOrder: 4,
      },
    ],
    currentPhaseId: 'phase-3',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows completed steps with green checkmarks, current step highlighted, and upcoming steps in gray',
      },
    },
  },
};

export const WithDates: Story = {
  args: {
    phases: [
      {
        id: 'phase-1',
        name: 'Discovery',
        startDate: '2024-01-15',
        endDate: '2024-01-31',
        sortOrder: 1,
      },
      {
        id: 'phase-2',
        name: 'Research',
        startDate: '2024-02-01',
        endDate: '2024-02-15',
        sortOrder: 2,
      },
      {
        id: 'phase-3',
        name: 'Analysis',
        startDate: '2024-02-16',
        endDate: '2024-03-01',
        sortOrder: 3,
      },
      {
        id: 'phase-4',
        name: 'Decision',
        startDate: '2024-03-02',
        endDate: '2024-03-15',
        sortOrder: 4,
      },
    ],
    currentPhaseId: 'phase-3',
  },
};

export const DecisionProcess: Story = {
  args: {
    phases: [
      {
        id: 'proposal',
        name: 'Proposal',
        description: 'Initial proposal submission',
        startDate: '2024-01-01',
        endDate: '2024-01-15',
        sortOrder: 1,
      },
      {
        id: 'review',
        name: 'Review',
        description: 'Community review period',
        startDate: '2024-01-16',
        endDate: '2024-01-31',
        sortOrder: 2,
      },
      {
        id: 'discussion',
        name: 'Discussion',
        description: 'Open discussion phase',
        startDate: '2024-02-01',
        endDate: '2024-02-14',
        sortOrder: 3,
      },
      {
        id: 'voting',
        name: 'Voting',
        description: 'Voting period',
        startDate: '2024-02-15',
        endDate: '2024-02-22',
        sortOrder: 4,
      },
      {
        id: 'implementation',
        name: 'Implementation',
        description: 'Implementation phase',
        startDate: '2024-02-23',
        sortOrder: 5,
      },
    ],
    currentPhaseId: 'discussion',
  },
};

export const FirstPhase: Story = {
  args: {
    phases: [
      {
        id: 'step-1',
        name: 'Current Step',
        sortOrder: 1,
      },
      {
        id: 'step-2',
        name: 'Upcoming',
        sortOrder: 2,
      },
      {
        id: 'step-3',
        name: 'Future',
        sortOrder: 3,
      },
    ],
    currentPhaseId: 'step-1',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows the first phase as current with all others upcoming (gray)',
      },
    },
  },
};

export const LastPhase: Story = {
  args: {
    phases: [
      {
        id: 'step-1',
        name: 'Completed',
        sortOrder: 1,
      },
      {
        id: 'step-2',
        name: 'Completed',
        sortOrder: 2,
      },
      {
        id: 'step-3',
        name: 'Final Step',
        sortOrder: 3,
      },
    ],
    currentPhaseId: 'step-3',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows completed steps with green checkmarks and the final step as current',
      },
    },
  },
};

export const AllStates: Story = {
  args: {
    phases: [
      {
        id: 'completed-1',
        name: 'Completed',
        sortOrder: 1,
      },
      {
        id: 'completed-2',
        name: 'Done',
        sortOrder: 2,
      },
      {
        id: 'current',
        name: 'In Progress',
        sortOrder: 3,
      },
      {
        id: 'upcoming-1',
        name: 'Next',
        sortOrder: 4,
      },
      {
        id: 'upcoming-2',
        name: 'Future',
        sortOrder: 5,
      },
    ],
    currentPhaseId: 'current',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows all three states: completed (green with checkmarks), current (black), and upcoming (gray)',
      },
    },
  },
};

export const ManyPhases: Story = {
  args: {
    phases: [
      { id: '1', name: 'Phase 1', sortOrder: 1 },
      { id: '2', name: 'Phase 2', sortOrder: 2 },
      { id: '3', name: 'Phase 3', sortOrder: 3 },
      { id: '4', name: 'Phase 4', sortOrder: 4 },
      { id: '5', name: 'Phase 5', sortOrder: 5 },
      { id: '6', name: 'Phase 6', sortOrder: 6 },
      { id: '7', name: 'Phase 7', sortOrder: 7 },
    ],
    currentPhaseId: '4',
  },
};

export const UnsortedPhases: Story = {
  args: {
    phases: [
      {
        id: 'third',
        name: 'Third Phase',
        sortOrder: 3,
      },
      {
        id: 'first',
        name: 'First Phase',
        sortOrder: 1,
      },
      {
        id: 'second',
        name: 'Second Phase',
        sortOrder: 2,
      },
      {
        id: 'fourth',
        name: 'Fourth Phase',
        sortOrder: 4,
      },
    ],
    currentPhaseId: 'second',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Phases are automatically sorted by sortOrder, regardless of array order',
      },
    },
  },
};

export const PartialDates: Story = {
  args: {
    phases: [
      {
        id: 'phase-1',
        name: 'Starting',
        startDate: '2024-01-01',
        sortOrder: 1,
      },
      {
        id: 'phase-2',
        name: 'Ongoing',
        sortOrder: 2,
      },
      {
        id: 'phase-3',
        name: 'Deadline',
        endDate: '2024-03-31',
        sortOrder: 3,
      },
    ],
    currentPhaseId: 'phase-2',
  },
  parameters: {
    docs: {
      description: {
        story: 'Phases can have only start dates, only end dates, or no dates',
      },
    },
  },
};
