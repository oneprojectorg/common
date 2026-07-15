import { Button } from '@op/sense/Button';
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from '@op/sense/ButtonGroup';
import { Input } from '@op/sense/Input';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LuCircleArrowLeft,
  LuCircleArrowRight,
  LuSearch,
} from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof ButtonGroup> = {
  title: 'Sense/ButtonGroup',
  component: ButtonGroup,
  decorators: [withSense],
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
      <Button variant="outline">Button</Button>
      <Button variant="outline">Button</Button>
      <Button variant="outline">Button</Button>
      <Button variant="outline" size="icon" aria-label="Back">
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
      <Button>Button</Button>
      <PrimaryGroupSeparator />
      <Button>Button</Button>
      <PrimaryGroupSeparator />
      <Button>Button</Button>
      <PrimaryGroupSeparator />
      <Button size="icon" aria-label="Back">
        <LuCircleArrowLeft />
      </Button>
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
  <ButtonGroupSeparator className="bg-[color-mix(in_oklch,var(--primary),white_20%)]" />
);
