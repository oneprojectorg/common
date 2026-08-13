import { Button } from '@op/sense/Button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@op/sense/Command';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import {
  LuBell,
  LuBuilding2,
  LuCalculator,
  LuCalendar,
  LuCreditCard,
  LuFilePlus,
  LuHouse,
  LuInbox,
  LuLogOut,
  LuScale,
  LuSettings,
  LuSmile,
  LuUser,
  LuUserPlus,
  LuVote,
  LuWorkflow,
} from 'react-icons/lu';

const meta: Meta<typeof Command> = {
  title: 'Primitives/Command',
  component: Command,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Command>;

const CommandContent = () => (
  <CommandList>
    <CommandEmpty>No results found.</CommandEmpty>
    <CommandGroup heading="Suggestions">
      <CommandItem>
        <LuCalendar />
        Calendar
      </CommandItem>
      <CommandItem>
        <LuSmile />
        Search Emoji
      </CommandItem>
      <CommandItem disabled>
        <LuCalculator />
        Calculator
      </CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Settings">
      <CommandItem>
        <LuUser />
        Profile
        <CommandShortcut>⌘P</CommandShortcut>
      </CommandItem>
      <CommandItem>
        <LuCreditCard />
        Billing
        <CommandShortcut>⌘B</CommandShortcut>
      </CommandItem>
      <CommandItem>
        <LuSettings />
        Settings
        <CommandShortcut>⌘S</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
);

export const Default: Story = {
  render: () => (
    <Command className="w-96">
      <CommandInput placeholder="Type a command or search" />
      <CommandContent />
    </Command>
  ),
};

const CommandDialogExample = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open command palette
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command>
          <CommandInput placeholder="Type a command or search" />
          <CommandContent />
        </Command>
      </CommandDialog>
    </>
  );
};

export const InDialog: Story = {
  render: () => <CommandDialogExample />,
};

// Enough groups and items to exceed the list's max-h-72, exercising the
// scroll behaviour (scrollbar hidden via the no-scrollbar utility).
export const ManyGroups: Story = {
  render: () => (
    <Command className="w-96">
      <CommandInput placeholder="Type a command or search" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem>
            <LuHouse />
            Home
            <CommandShortcut>⌘H</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <LuInbox />
            Inbox
            <CommandShortcut>⌘I</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <LuScale />
            Decisions
          </CommandItem>
          <CommandItem>
            <LuBuilding2 />
            Organizations
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Create">
          <CommandItem>
            <LuFilePlus />
            New proposal
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <LuWorkflow />
            New decision process
          </CommandItem>
          <CommandItem>
            <LuVote />
            Start a vote
          </CommandItem>
          <CommandItem>
            <LuUserPlus />
            Invite teammate
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem>
            <LuUser />
            Profile
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <LuBell />
            Notification settings
          </CommandItem>
          <CommandItem>
            <LuLogOut />
            Sign out
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
