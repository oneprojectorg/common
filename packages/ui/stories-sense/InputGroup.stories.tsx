import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '@op/sense/InputGroup';
import { Label } from '@op/sense/Label';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { LuCopy, LuInfo, LuSearch, LuSend } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof InputGroup> = {
  title: 'Sense/InputGroup',
  component: InputGroup,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof InputGroup>;

export const Default: Story = {
  render: () => (
    <div className="grid max-w-sm gap-2">
      <Label htmlFor="input-group-website">Website URL</Label>
      <InputGroup>
        <InputGroupAddon>
          <InputGroupText>https://</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput id="input-group-website" placeholder="example.com" />
        <InputGroupAddon align="inline-end">
          <LuInfo />
        </InputGroupAddon>
      </InputGroup>
    </div>
  ),
};

export const WithIcon: Story = {
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupAddon>
        <LuSearch />
      </InputGroupAddon>
      <InputGroupInput type="search" placeholder="Type to search..." />
    </InputGroup>
  ),
};

export const WithButton: Story = {
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupInput readOnly value="https://common.oneproject.org" />
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label="Copy">
          <LuCopy />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

export const WithTextarea: Story = {
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupTextarea placeholder="Send a message..." />
      <InputGroupAddon align="block-end">
        <InputGroupText className="text-sm">52 characters left</InputGroupText>
        <InputGroupButton size="icon-xs" className="ml-auto" aria-label="Send">
          <LuSend />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  ),
};

export const Disabled: Story = {
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupAddon>
        <InputGroupText>https://</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="example.com" disabled />
    </InputGroup>
  ),
};

export const Invalid: Story = {
  render: () => (
    <InputGroup className="max-w-sm">
      <InputGroupAddon>
        <InputGroupText>https://</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput placeholder="example.com" aria-invalid="true" />
    </InputGroup>
  ),
};
