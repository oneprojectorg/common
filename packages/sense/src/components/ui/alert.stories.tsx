import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@op/sense/Alert';
import { Button } from '@op/sense/Button';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  LuCircleAlert,
  LuCircleCheck,
  LuInfo,
  LuTriangleAlert,
} from 'react-icons/lu';

const meta: Meta<typeof Alert> = {
  title: 'Primitives/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'info', 'destructive', 'warning'],
    },
  },
};

export default meta;

type Story = StoryObj<typeof Alert>;

export const Default: Story = {
  render: (args) => (
    <Alert {...args} className="max-w-xl">
      <LuCircleCheck />
      <AlertTitle>Payment received</AlertTitle>
      <AlertDescription>
        Your invoice has been paid and a receipt was sent to your email.
      </AlertDescription>
    </Alert>
  ),
};

export const Variants: Story = {
  render: () => (
    <div className="flex max-w-xl flex-col gap-4">
      <Alert>
        <LuCircleCheck />
        <AlertTitle>Payment received</AlertTitle>
        <AlertDescription>
          Your invoice has been paid and a receipt was sent to your email.
        </AlertDescription>
      </Alert>
      <Alert variant="info">
        <LuInfo />
        <AlertTitle>Scheduled maintenance</AlertTitle>
        <AlertDescription>
          The platform will be read-only on Sunday between 02:00 and 04:00 UTC.
        </AlertDescription>
      </Alert>
      <Alert variant="warning">
        <LuTriangleAlert />
        <AlertTitle>Storage almost full</AlertTitle>
        <AlertDescription>
          You have used 92% of your storage. Remove unused files to free up
          space.
        </AlertDescription>
      </Alert>
      <Alert variant="destructive">
        <LuCircleAlert />
        <AlertTitle>Unable to save changes</AlertTitle>
        <AlertDescription>
          Your session has expired. Sign in again to continue editing.
        </AlertDescription>
      </Alert>
    </div>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Alert className="max-w-xl">
      <LuCircleAlert />
      <AlertTitle>Message archived</AlertTitle>
      <AlertDescription>
        The conversation was moved to your archive.
      </AlertDescription>
      <AlertAction>
        <Button variant="outline" size="sm">
          Undo
        </Button>
      </AlertAction>
    </Alert>
  ),
};

export const TitleOnly: Story = {
  render: () => (
    <Alert variant="info" className="max-w-xl">
      <LuInfo />
      <AlertTitle>A new version is available.</AlertTitle>
    </Alert>
  ),
};
