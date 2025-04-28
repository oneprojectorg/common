import type { Meta } from '@storybook/react';

import { ColorArea } from '../src/components/ColorArea';

const meta: Meta<typeof ColorArea> = {
  component: ColorArea,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: any) => <ColorArea {...args} />;
