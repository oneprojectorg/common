import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { LuCheck, LuChevronRight, LuEllipsis } from 'react-icons/lu';

import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/Menu';

const meta: Meta = {
  title: 'shadcn/Menu',
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button>Open menu</Button>} />
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => console.log('edit')}>
          Edit
          <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => console.log('duplicate')}>
          Duplicate
          <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => console.log('delete')}
        >
          Delete
          <DropdownMenuShortcut>⌫</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const WithIconButtonTrigger: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton aria-label="Row actions" variant="ghost">
            <LuEllipsis className="size-4" />
          </IconButton>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem>View</DropdownMenuItem>
        <DropdownMenuItem>Edit</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const Grouped: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button>Categorized</Button>} />
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Account</DropdownMenuLabel>
          <DropdownMenuItem>Profile</DropdownMenuItem>
          <DropdownMenuItem>Settings</DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Team</DropdownMenuLabel>
          <DropdownMenuItem>Invite</DropdownMenuItem>
          <DropdownMenuItem>Manage</DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};

export const WithCheckboxes: Story = {
  render: () => {
    const [features, setFeatures] = useState({
      drafts: true,
      published: true,
      archived: false,
    });
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button>Filter</Button>} />
        <DropdownMenuContent>
          <DropdownMenuLabel>Show</DropdownMenuLabel>
          <DropdownMenuCheckboxItem
            checked={features.drafts}
            onCheckedChange={(v) =>
              setFeatures((f) => ({ ...f, drafts: v === true }))
            }
          >
            Drafts
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={features.published}
            onCheckedChange={(v) =>
              setFeatures((f) => ({ ...f, published: v === true }))
            }
          >
            Published
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={features.archived}
            onCheckedChange={(v) =>
              setFeatures((f) => ({ ...f, archived: v === true }))
            }
          >
            Archived
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};

export const WithRadioGroup: Story = {
  render: () => {
    const [sort, setSort] = useState('recent');
    return (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button>Sort</Button>} />
        <DropdownMenuContent>
          <DropdownMenuLabel>Sort by</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
            <DropdownMenuRadioItem value="recent">Most recent</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="oldest">Oldest</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="alpha">Alphabetical</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },
};

export const WithSubmenu: Story = {
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button>Nested</Button>} />
      <DropdownMenuContent>
        <DropdownMenuItem>New file</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            More
            <LuChevronRight className="ml-auto size-4" />
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>
              <LuCheck className="size-4" />
              Apply theme
            </DropdownMenuItem>
            <DropdownMenuItem>Export</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
};
