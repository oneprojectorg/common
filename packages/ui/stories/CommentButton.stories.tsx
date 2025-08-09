import type { Meta } from '@storybook/react';

import { CommentButton } from '../src/components/CommentButton';

const meta: Meta<typeof CommentButton> = {
  title: 'CommentButton',
  component: CommentButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    count: {
      control: 'number',
    },
    isDisabled: {
      control: 'boolean',
    },
    className: {
      control: 'text',
    },
  },
  args: {
    count: 0,
    isDisabled: false,
  },
};

export default meta;

export const Example = () => (
  <div className="flex flex-col gap-4">
    <div className="flex items-center gap-4">
      <CommentButton count={0} />
      <CommentButton count={5} />
      <CommentButton count={42} />
      <CommentButton count={999} />
    </div>
    <div className="flex items-center gap-4">
      <CommentButton count={0} isDisabled />
      <CommentButton count={5} isDisabled />
    </div>
  </div>
);

export const NoComments = {
  args: {
    count: 0,
  },
};

export const WithComments = {
  args: {
    count: 23,
  },
};

export const ManyComments = {
  args: {
    count: 1247,
  },
};

export const Disabled = {
  args: {
    count: 15,
    isDisabled: true,
  },
};
