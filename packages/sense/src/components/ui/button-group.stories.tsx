import { Button } from '@op/sense/Button';
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from '@op/sense/ButtonGroup';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { Input } from '@op/sense/Input';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LuArchive,
  LuBellOff,
  LuCheck,
  LuClock,
  LuFolderInput,
  LuChevronDown,
  LuCircleArrowLeft,
  LuCircleArrowRight,
  LuCopy,
  LuForward,
  LuReply,
  LuSearch,
  LuShare,
  LuStar,
  LuTrash,
  LuTriangleAlert,
  LuUserX,
} from 'react-icons/lu';

const meta: Meta<typeof ButtonGroup> = {
  title: 'Primitives/ButtonGroup',
  component: ButtonGroup,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof ButtonGroup>;

export const Default: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Archive</Button>
      <Button variant="outline">Snooze</Button>
      <Button variant="outline">Move</Button>
    </ButtonGroup>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">
        <LuArchive data-icon="inline-start" />
        Archive
      </Button>
      <Button variant="outline">
        <LuClock data-icon="inline-start" />
        Snooze
      </Button>
      <Button variant="outline">
        <LuFolderInput data-icon="inline-start" />
        Move
      </Button>
      <Button variant="outline" size="icon" aria-label="Back">
        <LuCircleArrowLeft />
      </Button>
    </ButtonGroup>
  ),
};

export const Small: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline" size="sm">
        Archive
      </Button>
      <Button variant="outline" size="sm">
        Snooze
      </Button>
      <Button variant="outline" size="sm">
        Move
      </Button>
      <Button variant="outline" size="icon-sm" aria-label="Back">
        <LuCircleArrowLeft />
      </Button>
    </ButtonGroup>
  ),
};

// Separators over the primary fill need an opaque mix since they render
// over the page background.
export const WithSeparators: Story = {
  render: () => (
    <ButtonGroup>
      <Button>
        <LuReply data-icon="inline-start" />
        Reply
      </Button>
      <PrimaryGroupSeparator />
      <Button>
        <LuForward data-icon="inline-start" />
        Forward
      </Button>
      <PrimaryGroupSeparator />
      <Button>
        <LuStar data-icon="inline-start" />
        Favorite
      </Button>
      <PrimaryGroupSeparator />
      <Button size="icon" aria-label="Back">
        <LuCircleArrowLeft />
      </Button>
    </ButtonGroup>
  ),
};

export const SplitWithDropdown: Story = {
  render: () => (
    <ButtonGroup>
      <Button variant="outline">Follow</Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="icon" aria-label="More options" />
          }
        >
          <LuChevronDown />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <LuBellOff />
            Mute Conversation
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LuCheck />
            Mark as Read
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LuTriangleAlert />
            Report Conversation
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LuUserX />
            Block User
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LuShare />
            Share Conversation
          </DropdownMenuItem>
          <DropdownMenuItem>
            <LuCopy />
            Duplicate Conversation
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <LuTrash />
            Delete Conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </ButtonGroup>
  ),
};

export const Vertical: Story = {
  render: () => (
    <ButtonGroup orientation="vertical">
      <Button variant="outline">Top</Button>
      <Button variant="outline">Middle</Button>
      <Button variant="outline">Bottom</Button>
    </ButtonGroup>
  ),
};

export const WithText: Story = {
  render: () => (
    <ButtonGroup>
      <ButtonGroupText>
        <LuSearch />
        Search
      </ButtonGroupText>
      <Input placeholder="Find members..." />
      <Button variant="outline" size="icon" aria-label="Go">
        <LuCircleArrowRight />
      </Button>
    </ButtonGroup>
  ),
};

const PrimaryGroupSeparator = () => (
  <ButtonGroupSeparator variant="onPrimary" />
);
