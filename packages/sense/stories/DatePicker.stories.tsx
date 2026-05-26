import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { DatePicker } from '@/components/DatePicker';

const meta: Meta<typeof DatePicker> = {
  title: 'shadcn/DatePicker',
  component: DatePicker,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <div className="w-[20rem]">
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

export const Default: Story = {
  args: {
    label: 'Date',
  },
};

export const WithValue: Story = {
  args: {
    label: 'Birthday',
    defaultValue: new Date(1990, 0, 1),
  },
};

export const Required: Story = {
  args: {
    label: 'Deadline',
    isRequired: true,
  },
};

export const WithError: Story = {
  args: {
    label: 'Start date',
    errorMessage: 'Start date is required',
    isRequired: true,
  },
};

export const WithDescription: Story = {
  args: {
    label: 'Renewal',
    description: 'Choose any future date.',
    minValue: new Date(),
  },
};

export const Controlled: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(undefined);
    return (
      <DatePicker
        label="Trip start"
        value={date}
        onChange={setDate}
        description={date ? `Picked: ${date.toDateString()}` : 'No date yet'}
      />
    );
  },
};
