import { Button } from '@op/sense/Button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@op/sense/Item';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuFileText, LuFolder, LuImage } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof Item> = {
  title: 'Sense/Item',
  component: Item,
  decorators: [withSense],
};

export default meta;

type Story = StoryObj<typeof Item>;

export const Default: Story = {
  render: () => (
    <div className="w-lg">
      <Item variant="outline">
        <ItemMedia variant="icon">
          <LuFolder />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Item title</ItemTitle>
          <ItemDescription>Item description goes here</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline">Action</Button>
        </ItemActions>
      </Item>
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex w-lg flex-col gap-4">
      {(['default', 'outline', 'muted'] as const).map((variant) => (
        <Item key={variant} variant={variant}>
          <ItemMedia variant="icon">
            <LuFolder />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{variant}</ItemTitle>
            <ItemDescription>
              An item with the {variant} variant
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="outline">Action</Button>
          </ItemActions>
        </Item>
      ))}
    </div>
  ),
};

export const Group: Story = {
  render: () => (
    <div className="w-lg">
      <ItemGroup>
        <Item>
          <ItemMedia variant="icon">
            <LuFileText />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Quarterly report</ItemTitle>
            <ItemDescription>Updated 2 days ago</ItemDescription>
          </ItemContent>
        </Item>
        <ItemSeparator />
        <Item>
          <ItemMedia variant="icon">
            <LuImage />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Brand assets</ItemTitle>
            <ItemDescription>Updated last week</ItemDescription>
          </ItemContent>
        </Item>
        <ItemSeparator />
        <Item>
          <ItemMedia variant="icon">
            <LuFolder />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Archive</ItemTitle>
            <ItemDescription>Updated last month</ItemDescription>
          </ItemContent>
        </Item>
      </ItemGroup>
    </div>
  ),
};
