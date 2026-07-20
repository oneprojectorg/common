import {
  CollapsibleConfigCard,
  CollapsibleConfigCardDragPreview,
} from '@op/sense/CollapsibleConfigCard';
import { Sortable } from '@op/sense/Sortable';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LuListChecks, LuText, LuVote } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof CollapsibleConfigCard> = {
  title: 'Sense/Composites/CollapsibleConfigCard',
  component: CollapsibleConfigCard,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof CollapsibleConfigCard>;

export const Default: Story = {
  render: () => (
    <div className="flex w-96 flex-col gap-2">
      <CollapsibleConfigCard
        icon={LuText}
        label="Description"
        badgeLabel="Required"
        isCollapsible
        defaultExpanded
      >
        <p className="text-sm text-muted-foreground">
          Field configuration goes here.
        </p>
      </CollapsibleConfigCard>
      <CollapsibleConfigCard
        icon={LuListChecks}
        label="Categories"
        badgeLabel="Optional"
        isCollapsible
      >
        <p className="text-sm text-muted-foreground">Category options.</p>
      </CollapsibleConfigCard>
      <CollapsibleConfigCard icon={LuVote} label="Votes" locked />
    </div>
  ),
};

// The ProcessBuilder shape: sortable list of collapsible config cards with
// drag handles, a locked card, and a custom drag preview.
const SortableDemo = () => {
  const [fields, setFields] = useState([
    { id: 'title', label: 'Title', badge: 'Required' },
    { id: 'description', label: 'Description', badge: 'Required' },
    { id: 'budget', label: 'Budget', badge: 'Optional' },
  ]);

  return (
    <Sortable
      items={fields}
      onChange={setFields}
      dragTrigger="handle"
      aria-label="Form fields"
      className="w-96 gap-2"
      getItemLabel={(field) => field.label}
      renderDragPreview={([field]) =>
        field ? (
          <CollapsibleConfigCardDragPreview
            icon={LuText}
            label={field.label}
            badgeLabel={field.badge}
          />
        ) : null
      }
    >
      {(field, controls) => (
        <CollapsibleConfigCard
          icon={LuText}
          label={field.label}
          badgeLabel={field.badge}
          isCollapsible
          controls={controls}
        >
          <p className="text-sm text-muted-foreground">
            Configuration for {field.label}.
          </p>
        </CollapsibleConfigCard>
      )}
    </Sortable>
  );
};

export const SortableCards: Story = {
  render: () => <SortableDemo />,
};
