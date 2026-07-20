import { Button } from '@op/sense/Button';
import {
  CollapsibleConfigCard,
  CollapsibleConfigCardDragPreview,
} from '@op/sense/CollapsibleConfigCard';
import { Label } from '@op/sense/Label';
import { Separator } from '@op/sense/Separator';
import { Sortable } from '@op/sense/Sortable';
import { Switch } from '@op/sense/Switch';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LuTrash2, LuVote } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof CollapsibleConfigCard> = {
  title: 'Sense/Composites/CollapsibleConfigCard',
  component: CollapsibleConfigCard,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof CollapsibleConfigCard>;

// Mirrors the Template Card master: body content, separator, then a footer
// row with a Required switch and a small destructive Delete.
const CardBody = () => (
  <>
    <p className="text-base">This is an accordion content.</p>
    <Separator />
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Label htmlFor="required-toggle">Required?</Label>
        <Switch id="required-toggle" />
      </div>
      <Button variant="destructive" size="sm">
        <LuTrash2 data-icon="inline-start" />
        Delete
      </Button>
    </div>
  </>
);

// Cards are always sortable (locked cards are the only exception), so the
// default story is the ProcessBuilder shape: a sortable list with drag
// handles, a custom drag preview, and a locked card alongside.
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
      className="w-[36rem] gap-2"
      getItemLabel={(field) => field.label}
      renderDragPreview={([field]) =>
        field ? (
          <CollapsibleConfigCardDragPreview
            label={field.label}
            badgeLabel={field.badge}
          />
        ) : null
      }
    >
      {(field, controls) => (
        <CollapsibleConfigCard
          label={field.label}
          badgeLabel={field.badge}
          isCollapsible
          controls={controls}
        >
          <CardBody />
        </CollapsibleConfigCard>
      )}
    </Sortable>
  );
};

export const Default: Story = {
  render: () => <SortableDemo />,
};

export const Locked: Story = {
  render: () => (
    <div className="w-[36rem]">
      <CollapsibleConfigCard icon={LuVote} label="Votes" locked />
    </div>
  ),
};
