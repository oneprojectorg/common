import type { Meta } from '@storybook/react-vite';

import {
  Breadcrumb,
  BreadcrumbLink,
  Breadcrumbs,
} from '../src/components/Breadcrumbs';

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
    <Breadcrumb>
      <BreadcrumbLink href="/">Home</BreadcrumbLink>
    </Breadcrumb>
    <Breadcrumb>
      <BreadcrumbLink href="/react-aria">React Aria</BreadcrumbLink>
    </Breadcrumb>
    <Breadcrumb>Breadcrumbs</Breadcrumb>
  </Breadcrumbs>
);
