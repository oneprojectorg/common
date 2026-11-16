import type { BadgeSize } from '@op/sense/Badge';
import { Tag, TagGroup } from '@op/sense/TagGroup';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

const meta: Meta<typeof TagGroup> = {
  title: 'Composites/TagGroup',
  component: TagGroup,
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

const sizes: BadgeSize[] = ['default', 'md', 'lg'];

export const Sizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`Tag` passes `size` straight through to the underlying `Badge`, so a tag at a given size has the same height, text size and icon size as a `Badge` at that size. Tags default to `md`. The remove icon scales with the size.',
      },
    },
  },
  render: () => (
    <div className="flex max-w-md flex-col gap-6">
      {sizes.map((size) => (
        <TagGroup key={size} label={size}>
          {focusAreas.slice(0, 3).map((area) => (
            <Tag key={area} size={size}>
              {area}
            </Tag>
          ))}
          <Tag size={size} onRemove={() => {}} removeLabel="Remove Mutual aid">
            Mutual aid
          </Tag>
        </TagGroup>
      ))}
    </div>
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
