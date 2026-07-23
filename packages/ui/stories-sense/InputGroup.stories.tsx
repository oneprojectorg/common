import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from '@op/sense/InputGroup';
import { Label } from '@op/sense/Label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@op/sense/Tooltip';
import type { Meta, StoryObj } from '@storybook/react-vite';
import * as React from 'react';
import { LuCheck, LuCopy, LuInfo, LuSearch, LuSend } from 'react-icons/lu';

import { withSense } from './sense';

const meta: Meta<typeof InputGroup> = {
  title: 'Sense/Primitives/InputGroup',
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="About website URLs"
                  />
                }
              >
                <LuInfo />
              </TooltipTrigger>
              <TooltipContent className="sense">
                Your organization's public website address.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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

function CopyUrlDemo() {
  const url = 'https://common.oneproject.org';
  const [copied, setCopied] = React.useState(false);
  return (
    <InputGroup className="max-w-sm">
      <InputGroupInput readOnly value={url} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          aria-label={copied ? 'Copied' : 'Copy'}
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <LuCheck /> : <LuCopy />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export const WithButton: Story = {
  render: () => <CopyUrlDemo />,
};

const MESSAGE_LIMIT = 80;

function MessageDemo() {
  const [message, setMessage] = React.useState('');
  return (
    <InputGroup className="max-w-sm">
      <InputGroupTextarea
        placeholder="Send a message..."
        value={message}
        maxLength={MESSAGE_LIMIT}
        onChange={(event) => setMessage(event.target.value)}
      />
      <InputGroupAddon align="block-end">
        <InputGroupText className="text-sm">
          {MESSAGE_LIMIT - message.length} characters left
        </InputGroupText>
        <InputGroupButton
          size="icon-xs"
          className="ms-auto"
          aria-label="Send"
          disabled={message.length === 0}
        >
          <LuSend />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

export const WithTextarea: Story = {
  render: () => <MessageDemo />,
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
