import { Button } from '@op/sense/Button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@op/sense/Item';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuChevronRight, LuFileText, LuFolder, LuImage } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof Item> = {
  title: 'Sense/Item',
  component: Item,
  decorators: [withSense],
  tags: ['autodocs'],
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

export const Sizes: Story = {
  render: () => (
    <div className="flex w-lg flex-col gap-4">
      {(['default', 'sm', 'xs'] as const).map((size) => (
        <Item key={size} size={size} variant="outline">
          <ItemMedia variant="icon">
            <LuFolder />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>Size: {size}</ItemTitle>
            <ItemDescription>An item at the {size} size</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="outline" size="sm">
              Action
            </Button>
          </ItemActions>
        </Item>
      ))}
    </div>
  ),
};

// Items render as links via the base-ui `render` prop — the whole row is the
// anchor, with hover feedback from the item itself.
export const AsLink: Story = {
  render: () => (
    <div className="flex w-lg flex-col gap-4">
      <Item variant="outline" render={<a href="#" />}>
        <ItemContent>
          <ItemTitle>Review open proposals</ItemTitle>
          <ItemDescription>4 proposals are waiting on you</ItemDescription>
        </ItemContent>
        <ItemActions>
          <LuChevronRight className="size-4 rtl:rotate-180" />
        </ItemActions>
      </Item>
      <Item variant="muted" render={<a href="#" />}>
        <ItemContent>
          <ItemTitle>Voting closes Friday</ItemTitle>
          <ItemDescription>
            Cast your ballot before the phase ends
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <LuChevronRight className="size-4 rtl:rotate-180" />
        </ItemActions>
      </Item>
    </div>
  ),
};

export const WithImage: Story = {
  render: () => (
    <div className="flex w-lg flex-col gap-4">
      <Item variant="outline">
        <ItemMedia variant="image">
          <img src="https://github.com/shadcn.png" alt="Community garden" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle>Community garden fund</ItemTitle>
          <ItemDescription>Proposed by the Greenway circle</ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button variant="outline" size="sm">
            View
          </Button>
        </ItemActions>
      </Item>
    </div>
  ),
};

export const HeaderAndFooter: Story = {
  render: () => (
    <div className="w-lg">
      <Item variant="outline">
        <ItemHeader>
          <span className="text-sm text-muted-foreground">Proposal #42</span>
          <span className="text-sm text-muted-foreground">2 days left</span>
        </ItemHeader>
        <ItemContent>
          <ItemTitle>Neighborhood tool library</ItemTitle>
          <ItemDescription>
            A shared collection of tools members can borrow instead of buying.
          </ItemDescription>
        </ItemContent>
        <ItemFooter>
          <span className="text-sm text-muted-foreground">12 votes</span>
          <Button variant="outline" size="sm">
            Vote
          </Button>
        </ItemFooter>
      </Item>
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
