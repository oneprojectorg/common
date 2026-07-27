import { PhaseConfigRow } from '@op/sense/PhaseConfigRow';
import { Sortable } from '@op/sense/Sortable';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { withSense } from './sense';

const meta: Meta<typeof PhaseConfigRow> = {
  title: 'Sense/Composites/PhaseConfigRow',
  component: PhaseConfigRow,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof PhaseConfigRow>;

// Configured: green check + date range, "Edit" action.
export const Configured: Story = {
  render: () => (
    <div className="w-[40rem]">
      <PhaseConfigRow
        name="Proposal Submission"
        startDate="2026-01-15"
        endDate="2026-02-15"
        onAction={() => {}}
        onDelete={() => {}}
      />
    </div>
  ),
};

// Unconfigured: "Not configured yet." + "Configure" action.
export const Unconfigured: Story = {
  render: () => (
    <div className="w-[40rem]">
      <PhaseConfigRow
        name="Proposal Submission"
        onAction={() => {}}
        onDelete={() => {}}
      />
    </div>
  ),
};

interface PhaseData {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
}

const INITIAL_PHASES: PhaseData[] = [
  {
    id: 'submission',
    name: 'Proposal Submission',
    startDate: '2026-01-15',
    endDate: '2026-02-15',
  },
  {
    id: 'review',
    name: 'Review & Shortlist',
    startDate: '2026-02-16',
    endDate: '2026-03-01',
  },
  { id: 'voting', name: 'Voting' },
];

const ReorderablePhases = () => {
  const [phases, setPhases] = useState(INITIAL_PHASES);

  return (
    <Sortable
      items={phases}
      onChange={setPhases}
      dragTrigger="handle"
      aria-label="Reorder phases"
      getItemLabel={(phase) => phase.name}
      className="flex flex-col gap-3"
    >
      {(phase, { dragHandleProps }) => (
        <PhaseConfigRow
          name={phase.name}
          startDate={phase.startDate}
          endDate={phase.endDate}
          dragHandleProps={dragHandleProps}
          onAction={() => {}}
          onDelete={() => {}}
        />
      )}
    </Sortable>
  );
};

// The builder list: drag a phase by its grip to reorder. Configured and
// pending phases stack together.
export const List: Story = {
  render: () => (
    <div className="w-[40rem]">
      <ReorderablePhases />
    </div>
  ),
};
