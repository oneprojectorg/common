import { Tag, TagGroup } from '@op/sense/TagGroup';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Pair, Section } from '../../src/comparison/Comparison';
import {
  TagGroup as OldTagGroup,
  Tag as OldTag,
} from '../../src/components/TagGroup';

// Side-by-side of the @op/ui composite and its @op/sense port. One file per
// ported composite; the old column disappears with @op/ui.

const meta: Meta = {
  title: 'Sense Comparison/Composites/TagGroup',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const focusAreas = ['Climate justice', 'Food sovereignty', 'Housing'];

const RemovableNew = () => {
  const [tags, setTags] = useState(focusAreas);

  return (
    <TagGroup label="Topics">
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

const RemovableOld = () => {
  const [tags, setTags] = useState(focusAreas);

  return (
    <OldTagGroup
      label="Topics"
      onRemove={(keys) =>
        setTags((current) => current.filter((t) => !keys.has(t)))
      }
    >
      {tags.map((tag) => (
        <OldTag key={tag} id={tag}>
          {tag}
        </OldTag>
      ))}
    </OldTagGroup>
  );
};

export const TagGroupComparison: Story = {
  name: 'TagGroup',
  render: () => (
    <div className="p-8">
      <Section title="TagGroup">
        <Pair
          label="Static tags"
          old={
            <OldTagGroup label="Focus areas">
              {focusAreas.map((area) => (
                <OldTag key={area}>{area}</OldTag>
              ))}
            </OldTagGroup>
          }
          raw={
            <TagGroup label="Focus areas">
              {focusAreas.map((area) => (
                <Tag key={area}>{area}</Tag>
              ))}
            </TagGroup>
          }
        />
        <Pair label="Removable" old={<RemovableOld />} raw={<RemovableNew />} />
        <Pair
          label="Description + error"
          old={
            <OldTagGroup
              label="Invitees"
              description="Emails to invite."
              errorMessage="One address is invalid."
            >
              <OldTag>not-an-email</OldTag>
            </OldTagGroup>
          }
          raw={
            <TagGroup
              label="Invitees"
              description="Emails to invite."
              errorMessage="One address is invalid."
            >
              <Tag variant="destructive">not-an-email</Tag>
            </TagGroup>
          }
        />
      </Section>
    </div>
  ),
};
