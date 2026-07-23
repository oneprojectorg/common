import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@op/sense/ContextMenu';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LuArchive,
  LuCopy,
  LuPencil,
  LuScissors,
  LuShare2,
  LuTrash2,
} from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof ContextMenu> = {
  title: 'Sense/Primitives/ContextMenu',
  component: ContextMenu,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof ContextMenu>;

// The menu renders in a portal outside the `.sense` wrapper, so the content
// components re-scope themselves with `className="sense"`.
export const Default: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded-md border border-dashed border-input bg-muted text-sm text-muted-foreground">
        Right-click here
      </ContextMenuTrigger>
      <ContextMenuContent className="sense w-52">
        <ContextMenuItem>
          Back
          <ContextMenuShortcut>⌘[</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem disabled>
          Forward
          <ContextMenuShortcut>⌘]</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuItem>
          Reload
          <ContextMenuShortcut>⌘R</ContextMenuShortcut>
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>More Tools</ContextMenuSubTrigger>
          <ContextMenuSubContent className="sense">
            <ContextMenuItem>Save Page…</ContextMenuItem>
            <ContextMenuItem>Create Shortcut…</ContextMenuItem>
            <ContextMenuItem>Name Window…</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem>Developer Tools</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuCheckboxItem defaultChecked>
          Show Bookmarks
        </ContextMenuCheckboxItem>
        <ContextMenuCheckboxItem>Show Full URLs</ContextMenuCheckboxItem>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuLabel>People</ContextMenuLabel>
          <ContextMenuRadioGroup defaultValue="pedro">
            <ContextMenuRadioItem value="pedro">
              Pedro Duarte
            </ContextMenuRadioItem>
            <ContextMenuRadioItem value="colm">Colm Tuite</ContextMenuRadioItem>
          </ContextMenuRadioGroup>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <ContextMenu>
      <ContextMenuTrigger className="flex h-36 w-72 items-center justify-center rounded-md border border-dashed border-input bg-muted text-sm text-muted-foreground">
        Right-click here
      </ContextMenuTrigger>
      <ContextMenuContent className="sense w-52">
        <ContextMenuGroup>
          <ContextMenuItem>
            <LuPencil />
            Edit
          </ContextMenuItem>
          <ContextMenuItem>
            <LuCopy />
            Copy
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <LuScissors />
            Cut
            <ContextMenuShortcut>⌘X</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem>
            <LuShare2 />
            Share
          </ContextMenuItem>
        </ContextMenuGroup>
        <ContextMenuSeparator />
        <ContextMenuGroup>
          <ContextMenuItem>
            <LuArchive />
            Archive
          </ContextMenuItem>
          <ContextMenuItem variant="destructive">
            <LuTrash2 />
            Delete
            <ContextMenuShortcut>⌫</ContextMenuShortcut>
          </ContextMenuItem>
        </ContextMenuGroup>
      </ContextMenuContent>
    </ContextMenu>
  ),
};
