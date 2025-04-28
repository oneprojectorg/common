import type { Meta } from '@storybook/react';

import { ColorSwatch } from '../src/components/ColorSwatch';

const meta: Meta<typeof ColorSwatch> = {
  component: ColorSwatch,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: any) => <ColorSwatch {...args} />;

Example.args = {
  color: '#f00a',
};
