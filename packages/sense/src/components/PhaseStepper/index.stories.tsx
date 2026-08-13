import { PhaseStepper } from '@op/sense/PhaseStepper';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof PhaseStepper> = {
  title: 'Composites/PhaseStepper',
  component: PhaseStepper,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof PhaseStepper>;

const phases = [
  {
    id: 'submissions',
    name: 'Submissions',
    startDate: '2026-06-01',
    endDate: '2026-06-14',
  },
  {
    id: 'review',
    name: 'Review',
    startDate: '2026-06-15',
    endDate: '2026-06-28',
  },
  { id: 'voting', name: 'Voting', startDate: '2026-07-01' },
  { id: 'results', name: 'Results' },
];

export const Default: Story = {
  render: () => <PhaseStepper phases={phases} currentPhaseId="review" />,
};

// The upcoming phase is interactive: hover shows the ripple + play button.
export const WithTransition: Story = {
  render: () => (
    <PhaseStepper
      phases={[
        ...phases.slice(0, 2),
        {
          ...phases[2]!,
          interactive: true,
          showOnHoverOnly: true,
          ariaLabel: 'Start Voting',
        },
        phases[3]!,
      ]}
      currentPhaseId="review"
      onTransition={() => {}}
    />
  ),
};
