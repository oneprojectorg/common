import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  GradientHeader,
  Header1,
  Header2,
  Header3,
  Header4,
} from '@/components/Header';

const meta: Meta = {
  title: 'shadcn/Header',
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

export const Levels: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Header1>Header1</Header1>
      <Header2>Header2</Header2>
      <Header3>Header3</Header3>
      <Header4>Header4</Header4>
    </div>
  ),
};

export const Gradient: Story = {
  render: () => <GradientHeader>One Project</GradientHeader>,
};
