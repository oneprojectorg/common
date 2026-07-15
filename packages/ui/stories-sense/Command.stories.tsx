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
  LuCalculator,
  LuCalendar,
  LuCreditCard,
  LuSettings,
  LuSmile,
  LuUser,
} from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof Command> = {
  title: 'Sense/Command',
  component: Command,
  decorators: [withSense],
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

// The dialog renders in a portal outside the `.sense` wrapper, so it
// re-scopes itself with `className="sense"` (forwarded to DialogContent).
const CommandDialogExample = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open command palette
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} className="sense">
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
