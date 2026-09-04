import { Avatar, AvatarFallback } from '@op/sense/Avatar';
import { Button } from '@op/sense/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
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
import { getGradientForString } from '@op/styles/constants';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LuChevronDown,
  LuChevronRight,
  LuFileText,
  LuFolder,
  LuImage,
} from 'react-icons/lu';

const meta: Meta<typeof Item> = {
  title: 'Primitives/Item',
  component: Item,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Item>;

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('');

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
          <img
            src="https://picsum.photos/seed/garden/64/64"
            alt="Community garden"
          />
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

export const WithAvatar: Story = {
  render: () => (
    <div className="flex w-lg flex-col gap-4">
      {[
        ['Frida Kahlo', 'Steward · Greenway circle'],
        ['Mark Rothko', 'Member · Arts committee'],
      ].map(([name = '', role]) => (
        <Item key={name} variant="outline">
          <ItemMedia>
            <Avatar>
              <AvatarFallback
                className={`${getGradientForString(name)} text-white`}
              >
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{name}</ItemTitle>
            <ItemDescription>{role}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button variant="ghost" size="sm">
              Message
            </Button>
          </ItemActions>
        </Item>
      ))}
    </div>
  ),
};

// Compact xs rows in a muted group — the shape of a notification list.
export const CompactGroup: Story = {
  render: () => (
    <div className="w-lg">
      <ItemGroup className="gap-1">
        {[
          ['New proposal in Greenway', '2 minutes ago'],
          ['Voting opened for Budget 2027', '1 hour ago'],
          ['Frida Kahlo mentioned you', 'Yesterday'],
        ].map(([title, when]) => (
          <Item key={title} size="xs" variant="muted">
            <ItemContent>
              <ItemTitle>{title}</ItemTitle>
            </ItemContent>
            <ItemActions>
              <span className="text-xs text-muted-foreground">{when}</span>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </div>
  ),
};

// Card-style items: ItemHeader carries a full-bleed image above the content,
// and the group lays out as a grid (upstream item-header example).
export const Cards: Story = {
  render: () => (
    <ItemGroup className="grid w-2xl grid-cols-3 gap-4">
      {[
        ['Community garden', 'Shared beds and a seed library.'],
        ['Tool library', 'Borrow instead of buying.'],
        ['Street murals', 'Local artists, public walls.'],
      ].map(([title = '', description]) => (
        <Item key={title} variant="outline">
          <ItemHeader>
            <img
              src={`https://picsum.photos/seed/${encodeURIComponent(title)}/300/300`}
              alt={title}
              className="aspect-square w-full rounded-sm object-cover"
            />
          </ItemHeader>
          <ItemContent>
            <ItemTitle>{title}</ItemTitle>
            <ItemDescription>{description}</ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  ),
};

// Items as rich dropdown rows (upstream item-dropdown example). The xs size
// zeroes the item's own padding inside menu content, so the menu item's
// padding does the work.
export const InDropdown: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        Assign to
        <LuChevronDown data-icon="inline-end" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {[
          ['Frida Kahlo', 'frida@example.com'],
          ['Mark Rothko', 'mark@example.com'],
          ['Sonia Delaunay', 'sonia@example.com'],
        ].map(([name = '', email]) => (
          <DropdownMenuItem key={name} className="p-2">
            <Item size="xs" className="w-full">
              <ItemMedia>
                <Avatar size="sm">
                  <AvatarFallback
                    className={`${getGradientForString(name)} text-white`}
                  >
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent className="gap-0.5">
                <ItemTitle>{name}</ItemTitle>
                <ItemDescription>{email}</ItemDescription>
              </ItemContent>
            </Item>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
