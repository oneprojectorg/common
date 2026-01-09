import type { Meta } from '@storybook/react-vite';

import { Breadcrumb, Breadcrumbs } from '../src/components/Breadcrumbs';

const meta: Meta<typeof Breadcrumbs> = {
  component: Breadcrumbs,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

export const Example = (args: any) => (
  <Breadcrumbs {...args}>
    <Breadcrumb href="/">Home</Breadcrumb>
    <Breadcrumb href="/react-aria">React Aria</Breadcrumb>
    <Breadcrumb>Breadcrumbs</Breadcrumb>
  </Breadcrumbs>
);
