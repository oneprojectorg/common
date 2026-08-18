import { DragHandle, Sortable } from '@op/sense/Sortable';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta: Meta<typeof Sortable> = {
  title: 'Composites/Sortable',
  component: Sortable,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Sortable>;

const initialPhases = [
  { id: 'submissions', name: 'Submissions' },
  { id: 'review', name: 'Review' },
  { id: 'voting', name: 'Voting' },
  { id: 'results', name: 'Results' },
];

// Drag the handle to reorder. Keyboard: tab to a handle, space to lift,
// arrows to move, space to drop.
const WithHandleDemo = () => {
  const [phases, setPhases] = useState(initialPhases);

  return (
    <Sortable
      items={phases}
      onChange={setPhases}
      dragTrigger="handle"
      aria-label="Process phases"
      className="w-80 gap-2"
      getItemLabel={(phase) => phase.name}
    >
      {(phase, controls) => (
        <div className="flex items-center gap-2 rounded-lg border bg-background p-3">
          <DragHandle {...controls.dragHandleProps} />
          <span className="text-base">{phase.name}</span>
        </div>
      )}
    </Sortable>
  );
};

export const WithHandle: Story = {
  render: () => <WithHandleDemo />,
};

// The whole row is draggable when dragTrigger="item".
const WholeItemDemo = () => {
  const [phases, setPhases] = useState(initialPhases);

  return (
    <Sortable
      items={phases}
      onChange={setPhases}
      dragTrigger="item"
      aria-label="Process phases"
      className="w-80 gap-2"
      getItemLabel={(phase) => phase.name}
    >
      {(phase) => (
        <div className="rounded-lg border bg-background p-3 text-base">
          {phase.name}
        </div>
      )}
    </Sortable>
  );
};

export const WholeItemDrag: Story = {
  render: () => <WholeItemDemo />,
};

// Rows are both the drag target and the scroll surface here. Check with device
// emulation — a mouse wheel scrolls regardless of the rows' `touch-action`.
const WholeItemDragInScrollingListDemo = () => {
  const [phases, setPhases] = useState(
    Array.from({ length: 12 }, (_, index) => ({
      id: `phase-${index}`,
      name: `Phase ${index + 1}`,
    })),
  );

  return (
    <div className="h-64 w-80 overflow-y-auto rounded-lg border p-2">
      <Sortable
        items={phases}
        onChange={setPhases}
        dragTrigger="item"
        aria-label="Process phases"
        className="gap-2"
        getItemLabel={(phase) => phase.name}
      >
        {(phase) => (
          <div className="rounded-lg border bg-background p-3 text-base">
            {phase.name}
          </div>
        )}
      </Sortable>
    </div>
  );
};

export const WholeItemDragInScrollingList: Story = {
  render: () => <WholeItemDragInScrollingListDemo />,
};
