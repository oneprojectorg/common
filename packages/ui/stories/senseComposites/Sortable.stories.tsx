import { DragHandle, Sortable } from '@op/sense/Sortable';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Pair, Section } from '../../src/comparison/Comparison';
import {
  DragHandle as OldDragHandle,
  Sortable as OldSortable,
} from '../../src/components/Sortable';

const meta: Meta = {
  title: 'Sense Comparison/Composites/Sortable',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const initialItems = [
  { id: 'a', name: 'Submissions' },
  { id: 'b', name: 'Review' },
  { id: 'c', name: 'Voting' },
];

const NewDemo = () => {
  const [items, setItems] = useState(initialItems);

  return (
    <Sortable
      items={items}
      onChange={setItems}
      dragTrigger="handle"
      aria-label="Phases"
      className="w-64 gap-2"
      getItemLabel={(item) => item.name}
    >
      {(item, controls) => (
        <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
          <DragHandle {...controls.dragHandleProps} />
          <span className="text-sm">{item.name}</span>
        </div>
      )}
    </Sortable>
  );
};

const OldDemo = () => {
  const [items, setItems] = useState(initialItems);

  return (
    <OldSortable
      items={items}
      onChange={setItems}
      dragTrigger="handle"
      aria-label="Phases"
      className="w-64 gap-2"
      getItemLabel={(item) => item.name}
    >
      {(item, controls) => (
        <div className="flex items-center gap-2 rounded-lg border border-neutral-gray1 bg-white p-2">
          <OldDragHandle {...controls.dragHandleProps} />
          <span className="text-sm">{item.name}</span>
        </div>
      )}
    </OldSortable>
  );
};

export const SortableComparison: Story = {
  name: 'Sortable',
  render: () => (
    <div className="p-8">
      <Section title="Sortable">
        <Pair label="Handle drag" old={<OldDemo />} raw={<NewDemo />} />
      </Section>
    </div>
  ),
};
