import { Label } from '@op/sense/Label';
import { Slider } from '@op/sense/Slider';
import type { Meta, StoryObj } from '@storybook/react-vite';

import { withSense } from './sense';

const meta: Meta<typeof Slider> = {
  title: 'Sense/Primitives/Slider',
  component: Slider,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  render: () => (
    <div className="w-96">
      <Slider defaultValue={[62]} />
    </div>
  ),
};

export const Range: Story = {
  render: () => (
    <div className="w-96">
      <Slider defaultValue={[25, 75]} />
    </div>
  ),
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-96 gap-3">
      <Label htmlFor="slider-volume">Volume</Label>
      <Slider id="slider-volume" defaultValue={[40]} />
    </div>
  ),
};

export const Steps: Story = {
  render: () => (
    <div className="w-96">
      <Slider defaultValue={[40]} min={0} max={100} step={10} />
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="h-48">
      <Slider defaultValue={[62]} orientation="vertical" />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div className="w-96">
      <Slider defaultValue={[62]} disabled />
    </div>
  ),
};
