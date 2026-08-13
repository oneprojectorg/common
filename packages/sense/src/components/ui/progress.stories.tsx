import { Progress, ProgressLabel, ProgressValue } from '@op/sense/Progress';
import type { Meta, StoryObj } from '@storybook/react-vite';

const meta: Meta<typeof Progress> = {
  title: 'Primitives/Progress',
  component: Progress,
  tags: ['autodocs'],
  args: {
    value: 50,
  },
};

export default meta;

type Story = StoryObj<typeof Progress>;

export const Default: Story = {
  render: (args) => <Progress {...args} className="w-80" />,
};

export const WithLabelAndValue: Story = {
  render: () => (
    <Progress value={66} className="w-80">
      <ProgressLabel>Uploading files</ProgressLabel>
      <ProgressValue />
    </Progress>
  ),
};

export const Values: Story = {
  render: () => (
    <div className="flex w-80 flex-col gap-6">
      {[0, 25, 50, 75, 100].map((value) => (
        <Progress key={value} value={value} />
      ))}
    </div>
  ),
};
