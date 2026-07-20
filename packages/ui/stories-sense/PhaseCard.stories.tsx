import { PhaseCard } from '@op/sense/PhaseCard';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof PhaseCard> = {
  title: 'Sense/Composites/PhaseCard',
  component: PhaseCard,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof PhaseCard>;

// The consumer owns the <ol>; each card is an <li> with a state-driven
// treatment — the shape of the decision Overview timeline.
export const Timeline: Story = {
  render: () => (
    <ol className="flex w-96 flex-col gap-2">
      <PhaseCard
        state="completed"
        name="Submissions"
        startDate="2026-06-01"
        endDate="2026-06-14"
      />
      <PhaseCard
        state="current"
        name="Review"
        startDate="2026-06-15"
        endDate="2026-06-28"
        isNowOpen
        href="#"
      />
      <PhaseCard
        state="upcoming"
        name="Voting"
        startDate="2026-07-01"
        endDate="2026-07-14"
      />
      <PhaseCard state="upcoming" name="Results" />
    </ol>
  ),
};

export const Advanceable: Story = {
  render: () => (
    <ol className="flex w-96 flex-col gap-2">
      <PhaseCard
        state="upcoming"
        name="Voting"
        startDate="2026-07-01"
        isAdvanceable
        advanceLabel="Advance"
        onAdvance={() => {}}
      />
    </ol>
  ),
};
