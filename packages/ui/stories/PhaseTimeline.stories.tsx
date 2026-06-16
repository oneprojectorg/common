import type { Meta, StoryObj } from '@storybook/react-vite';

import { PhaseTimeline } from '../src/components/PhaseTimeline';

const meta: Meta<typeof PhaseTimeline> = {
  title: 'PhaseTimeline',
  component: PhaseTimeline,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    currentPhaseId: {
      control: 'select',
      options: ['collect', 'review', 'vote', 'results'],
    },
    onAdvance: { action: 'onAdvance' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const phases = [
  {
    id: 'collect',
    name: 'Collect Ideas',
    startDate: '2026-07-01',
    endDate: '2026-07-31',
  },
  {
    id: 'review',
    name: 'Review',
    startDate: '2026-08-01',
    endDate: '2026-09-15',
  },
  {
    id: 'vote',
    name: 'Vote',
    startDate: '2026-09-16',
    endDate: '2026-11-31',
  },
  { id: 'results', name: 'Share Results', endDate: '2026-12-18' },
];

export const Default: Story = {
  args: {
    phases,
    currentPhaseId: 'review',
    nowOpenPhaseId: 'review',
    href: '#',
  },
  render: (args) => (
    <div className="max-w-[340px]">
      <PhaseTimeline {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Completed phases show a green check rail, the current phase a filled teal card with the "Now open!" tag and an arrow, and upcoming phases a gray rail.',
      },
    },
  },
};

export const AdminAdvanceable: Story = {
  args: {
    phases,
    currentPhaseId: 'review',
    nowOpenPhaseId: 'review',
    advanceablePhaseId: 'vote',
    href: '#',
  },
  render: (args) => (
    <div className="max-w-[340px]">
      <PhaseTimeline {...args} />
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'For admins, the next phase renders as an off-white card with an Advance button.',
      },
    },
  },
};
