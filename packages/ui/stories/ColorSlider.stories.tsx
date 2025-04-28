import type { Meta } from '@storybook/react';

import { ColorSlider } from '../src/components/ColorSlider';

const meta: Meta<typeof ColorSlider> = {
  component: ColorSlider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: any) => <ColorSlider {...args} />;

Example.args = {
  label: 'Fill Color',
  channel: 'hue',
  colorSpace: 'hsl',
  defaultValue: '#f00',
};
