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

// The consumer owns the list: each card goes in its own <li>. Single-state
// stories wrap one card so each treatment can be reviewed on its own.
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

// A row that hangs its own content off the card — the list item is the
// consumer's, so there is nothing to opt out of.
export const ConsumerOwnedRow: Story = {
  render: () => (
    <ol className="w-96">
      <li className="flex flex-col">
        <PhaseCard
          state="upcoming"
          name="Voting"
          startDate="2026-07-01"
          endDate="2026-07-14"
        />
        <p className="px-4 pb-4 text-sm text-muted-foreground">
          Not configured
        </p>
      </li>
    </ol>
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
