import { PhaseCard } from '@op/sense/PhaseCard';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';

const meta: Meta<typeof PhaseCard> = {
  title: 'Composites/PhaseCard',
  component: PhaseCard,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof PhaseCard>;

const Row = ({ children }: { children: ReactNode }) => (
  <ol className="w-96">
    <li>{children}</li>
  </ol>
);

// The states composed into the decision Overview timeline — the default view.
export const Timeline: Story = {
  render: () => (
    <ol className="flex w-96 flex-col gap-2">
      <li>
        <PhaseCard
          state="completed"
          name="Submissions"
          startDate="2026-06-01"
          endDate="2026-06-14"
        />
      </li>
      <li>
        <PhaseCard
          state="current"
          name="Review"
          startDate="2026-06-15"
          endDate="2026-06-28"
          isNowOpen
          href="#"
        />
      </li>
      <li>
        <PhaseCard
          state="upcoming"
          name="Voting"
          startDate="2026-07-01"
          endDate="2026-07-14"
          isAdvanceable
          onAdvance={() => {}}
        />
      </li>
      <li>
        <PhaseCard state="upcoming" name="Results" />
      </li>
    </ol>
  ),
};

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
