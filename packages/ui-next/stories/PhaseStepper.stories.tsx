import type { Meta, StoryObj } from '@storybook/react-vite';

import { PhaseStepper } from '@/components/PhaseStepper';

const meta: Meta<typeof PhaseStepper> = {
  title: 'shadcn/PhaseStepper',
  component: PhaseStepper,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[44rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PhaseStepper>;

const phases = [
  { id: 'submit', name: 'Submission', startDate: '2026-05-01', endDate: '2026-05-14' },
  { id: 'review', name: 'Review', startDate: '2026-05-15', endDate: '2026-05-25' },
  { id: 'vote', name: 'Voting', startDate: '2026-05-26', endDate: '2026-06-01' },
  { id: 'results', name: 'Results', startDate: '2026-06-02', endDate: '2026-06-05' },
];

export const Default: Story = {
  render: () => <PhaseStepper phases={phases} currentPhaseId="review" />,
};

export const FirstPhase: Story = {
  render: () => <PhaseStepper phases={phases} currentPhaseId="submit" />,
};

export const LastPhase: Story = {
  render: () => <PhaseStepper phases={phases} currentPhaseId="results" />,
};
