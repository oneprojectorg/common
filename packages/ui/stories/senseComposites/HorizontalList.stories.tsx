import { HorizontalList, HorizontalListItem } from '@op/sense/HorizontalList';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { Pair, Section } from '../../src/comparison/Comparison';
import {
  HorizontalList as OldHorizontalList,
  HorizontalListItem as OldHorizontalListItem,
} from '../../src/components/HorizontalList';

const meta: Meta = {
  title: 'Sense Comparison/Composites/HorizontalList',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const tiles = (
  Item: React.ComponentType<{ children: React.ReactNode; className?: string }>,
) =>
  Array.from({ length: 8 }, (_, i) => (
    <Item key={i}>
      <div className="flex h-20 w-32 items-center justify-center rounded-lg border bg-muted text-sm">
        {i + 1}
      </div>
    </Item>
  ));

export const HorizontalListComparison: Story = {
  name: 'HorizontalList',
  render: () => (
    <div className="p-8">
      <Section title="HorizontalList">
        <Pair
          label="Snap strip"
          old={
            <OldHorizontalList className="max-w-sm">
              {tiles(OldHorizontalListItem)}
            </OldHorizontalList>
          }
          raw={
            <HorizontalList className="max-w-sm">
              {tiles(HorizontalListItem)}
            </HorizontalList>
          }
        />
      </Section>
    </div>
  ),
};
