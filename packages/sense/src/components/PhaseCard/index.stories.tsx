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

// Editing rail: each ready card opens its phase editor; unfinished ones ask
// for setup, the first of them with the primary button.
export const Editing: Story = {
  render: () => (
    <ol className="flex w-96 flex-col gap-2">
      <li>
        <PhaseCard
          state="completed"
          name="Submissions"
          startDate="2026-06-01"
          endDate="2026-06-14"
          onOpen={() => {}}
          openLabel="Set up Submissions"
        />
      </li>
      <li>
        <PhaseCard
          state="current"
          name="Review"
          startDate="2026-06-15"
          endDate="2026-06-28"
          isNowOpen
          onOpen={() => {}}
          openLabel="Set up Review"
        />
      </li>
      <li>
        <PhaseCard
          state="upcoming"
          name="Voting"
          needsSetup
          isLead
          blurb="Members vote on the shortlisted proposals."
          onOpen={() => {}}
          openLabel="Set up Voting"
        />
      </li>
      <li>
        <PhaseCard
          state="upcoming"
          name="Results"
          needsSetup
          blurb="Share the outcome with everyone."
          onOpen={() => {}}
          openLabel="Set up Results"
        />
      </li>
    </ol>
  ),
};

// Setup: a phase still missing what it needs to run.
export const Setup: Story = {
  render: () => (
    <Row>
      <PhaseCard
        state="upcoming"
        name="Voting"
        needsSetup
        isLead
        blurb="Members vote on the shortlisted proposals."
        onOpen={() => {}}
        openLabel="Set up Voting"
      />
    </Row>
  ),
};
