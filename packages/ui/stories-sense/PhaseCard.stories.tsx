import { PhaseCard } from '@op/sense/PhaseCard';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';

import { withSense } from './sense';

const meta: Meta<typeof PhaseCard> = {
  title: 'Sense/Composites/PhaseCard',
  component: PhaseCard,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof PhaseCard>;

// Each card is an <li>; the consumer owns the <ol>. Single-state stories
// wrap one card so each treatment can be reviewed on its own.
const Row = ({ children }: { children: ReactNode }) => (
  <ol className="w-96">{children}</ol>
);

// Completed: gray rail, name with a green check, dates below.
export const Completed: Story = {
  render: () => (
    <Row>
      <PhaseCard
        state="completed"
        name="Submissions"
        startDate="2026-06-01"
        endDate="2026-06-14"
      />
    </Row>
  ),
};

// Current: filled teal card linking out; the arrow reveals on hover/focus.
export const Current: Story = {
  render: () => (
    <Row>
      <PhaseCard
        state="current"
        name="Review"
        startDate="2026-06-15"
        endDate="2026-06-28"
        isNowOpen
        href="#"
      />
    </Row>
  ),
};

// Upcoming: gray rail, name over dates.
export const Upcoming: Story = {
  render: () => (
    <Row>
      <PhaseCard
        state="upcoming"
        name="Voting"
        startDate="2026-07-01"
        endDate="2026-07-14"
      />
    </Row>
  ),
};

// Advanceable: light card with a Start button.
export const Advanceable: Story = {
  render: () => (
    <Row>
      <PhaseCard
        state="upcoming"
        name="Voting"
        startDate="2026-07-01"
        isAdvanceable
        onAdvance={() => {}}
      />
    </Row>
  ),
};

// The states composed into the decision Overview timeline.
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
