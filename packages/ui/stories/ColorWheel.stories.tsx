import type { Meta } from '@storybook/react';

import { ColorWheel } from '../src/components/ColorWheel';

const meta: Meta<typeof ColorWheel> = {
  component: ColorWheel,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: any) => <ColorWheel {...args} />;
