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
import { useId, useState } from 'react';
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

const requiredBadge = (required: boolean) =>
  required ? 'Required' : 'Optional';

// Mirrors the Template Card master: body content, separator, then a footer
// row with a Required switch and a small destructive Delete. The switch
// drives the header badge (the consumer owns that wiring — the card is
// presentational).
const CardBody = ({
  required,
  onRequiredChange,
}: {
  required: boolean;
  onRequiredChange: (required: boolean) => void;
}) => {
  const toggleId = useId();

  return (
    <>
      <p className="text-base">This is an accordion content.</p>
      <Separator />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Label htmlFor={toggleId}>Required?</Label>
          <Switch
            id={toggleId}
            checked={required}
            onCheckedChange={onRequiredChange}
          />
        </div>
        <Button variant="destructive" size="sm">
          <LuTrash2 data-icon="inline-start" />
          Delete
        </Button>
      </div>
    </>
  );
};

// Cards are always sortable (locked cards are the only exception), so the
// default story is the ProcessBuilder shape: a sortable list with drag
// handles, a custom drag preview, and a locked card alongside.
const SortableDemo = () => {
  const [fields, setFields] = useState([
    { id: 'title', label: 'Title', required: true },
    { id: 'description', label: 'Description', required: true },
    { id: 'budget', label: 'Budget', required: false },
  ]);

  const setRequired = (id: string, required: boolean) =>
    setFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, required } : field)),
    );

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
            badgeLabel={requiredBadge(field.required)}
          />
        ) : null
      }
    >
      {(field, controls) => (
        <CollapsibleConfigCard
          label={field.label}
          badgeLabel={requiredBadge(field.required)}
          isCollapsible
          controls={controls}
        >
          <CardBody
            required={field.required}
            onRequiredChange={(required) => setRequired(field.id, required)}
          />
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
