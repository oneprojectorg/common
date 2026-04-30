import type { Meta } from '@storybook/react-vite';

import { Switch } from '../src/components/Switch';

const meta: Meta<typeof Switch> = {
  component: Switch,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: any) => <Switch {...args}>Pin</Switch>;

export const Small = (args: any) => (
  <Switch {...args} size="sm">
    Pin
  </Switch>
);
