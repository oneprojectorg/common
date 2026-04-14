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
    onTransition: { action: 'onTransition' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    phases: [
      { id: 'phase-1', name: 'Planning' },
      { id: 'phase-2', name: 'Design' },
      { id: 'phase-3', name: 'Development' },
      { id: 'phase-4', name: 'Testing' },
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
      },
      {
        id: 'phase-2',
        name: 'Research',
        startDate: '2024-02-01',
        endDate: '2024-02-15',
      },
      {
        id: 'phase-3',
        name: 'Analysis',
        startDate: '2024-02-16',
        endDate: '2024-03-01',
      },
      {
        id: 'phase-4',
        name: 'Decision',
        startDate: '2024-03-02',
        endDate: '2024-03-15',
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
      },
      {
        id: 'review',
        name: 'Review',
        description: 'Community review period',
        startDate: '2024-01-16',
        endDate: '2024-01-31',
      },
      {
        id: 'discussion',
        name: 'Discussion',
        description: 'Open discussion phase',
        startDate: '2024-02-01',
        endDate: '2024-02-14',
      },
      {
        id: 'voting',
        name: 'Voting',
        description: 'Voting period',
        startDate: '2024-02-15',
        endDate: '2024-02-22',
      },
      {
        id: 'implementation',
        name: 'Implementation',
        description: 'Implementation phase',
        startDate: '2024-02-23',
      },
    ],
    currentPhaseId: 'discussion',
  },
};

export const FirstPhase: Story = {
  args: {
    phases: [
      { id: 'step-1', name: 'Current Step' },
      { id: 'step-2', name: 'Upcoming' },
      { id: 'step-3', name: 'Future' },
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
      { id: 'step-1', name: 'Completed' },
      { id: 'step-2', name: 'Completed' },
      { id: 'step-3', name: 'Final Step' },
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
      { id: 'completed-1', name: 'Completed' },
      { id: 'completed-2', name: 'Done' },
      { id: 'current', name: 'In Progress' },
      { id: 'upcoming-1', name: 'Next' },
      { id: 'upcoming-2', name: 'Future' },
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
      { id: '1', name: 'Phase 1' },
      { id: '2', name: 'Phase 2' },
      { id: '3', name: 'Phase 3' },
      { id: '4', name: 'Phase 4' },
      { id: '5', name: 'Phase 5' },
      { id: '6', name: 'Phase 6' },
      { id: '7', name: 'Phase 7' },
    ],
    currentPhaseId: '4',
  },
};

export const PartialDates: Story = {
  args: {
    phases: [
      { id: 'phase-1', name: 'Starting', startDate: '2024-01-01' },
      { id: 'phase-2', name: 'Ongoing' },
      { id: 'phase-3', name: 'Deadline', endDate: '2024-03-31' },
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

export const InteractivePhases: Story = {
  args: {
    phases: [
      { id: 'phase-1', name: 'Proposal', interactive: true },
      { id: 'phase-2', name: 'Review', interactive: true },
      { id: 'phase-3', name: 'Voting', interactive: true },
      { id: 'phase-4', name: 'Results' },
    ],
    currentPhaseId: 'phase-2',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Interactive phases display a teal play icon and show rippling rings on hover. Triggers onTransition when clicked. Non-interactive phases remain static.',
      },
    },
  },
};

export const MixedInteractivity: Story = {
  args: {
    phases: [
      { id: 'phase-1', name: 'Planning' },
      { id: 'phase-2', name: 'Development', interactive: true },
      { id: 'phase-3', name: 'Testing' },
      { id: 'phase-4', name: 'Release', interactive: true },
    ],
    currentPhaseId: 'phase-1',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Only specific phases are interactive — hover over Development and Release to see the ripple effect',
      },
    },
  },
};
