import { ColorPicker } from '../src/components/ColorPicker';

import type { Meta } from '@storybook/react';

const meta: Meta<typeof ColorPicker> = {
  component: ColorPicker,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    label: 'Color',
    defaultValue: '#ff0',
  },
};

export default meta;

export const Example = (args: any) => <ColorPicker {...args} />;
