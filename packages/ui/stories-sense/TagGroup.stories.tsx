import { Tag, TagGroup } from '@op/sense/TagGroup';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { withSense } from './sense';

const meta: Meta<typeof TagGroup> = {
  title: 'Sense/Composites/TagGroup',
  component: TagGroup,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof TagGroup>;

const focusAreas = [
  'Climate justice',
  'Food sovereignty',
  'Housing',
  'Mutual aid',
  'Participatory budgeting',
];

export const Default: Story = {
  render: () => (
    <TagGroup label="Focus areas" className="max-w-md">
      {focusAreas.map((area) => (
        <Tag key={area}>{area}</Tag>
      ))}
    </TagGroup>
  ),
};

export const Variants: Story = {
  render: () => (
    <TagGroup className="max-w-md">
      {(['accent', 'default', 'secondary', 'outline'] as const).map(
        (variant) => (
          <Tag key={variant} variant={variant}>
            {variant}
          </Tag>
        ),
      )}
    </TagGroup>
  ),
};

// Removable tags are stateful so the remove buttons actually work.
const RemovableDemo = () => {
  const [tags, setTags] = useState(focusAreas);

  return (
    <TagGroup
      label="Selected topics"
      description="Remove topics that no longer apply."
      className="max-w-md"
    >
      {tags.map((tag) => (
        <Tag
          key={tag}
          onRemove={() =>
            setTags((current) => current.filter((t) => t !== tag))
          }
          removeLabel={`Remove ${tag}`}
        >
          {tag}
        </Tag>
      ))}
    </TagGroup>
  );
};

export const Removable: Story = {
  render: () => <RemovableDemo />,
};

export const WithError: Story = {
  render: () => (
    <TagGroup
      label="Invitees"
      errorMessage="One or more email addresses are invalid."
      className="max-w-md"
    >
      <Tag variant="destructive">not-an-email</Tag>
      <Tag>frida@example.com</Tag>
    </TagGroup>
  ),
};
