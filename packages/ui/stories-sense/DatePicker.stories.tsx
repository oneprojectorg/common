import { DatePicker, DatePickerButton } from '@op/sense/DatePicker';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { withSense } from './sense';

const meta: Meta<typeof DatePicker> = {
  title: 'Sense/Composites/DatePicker',
  component: DatePicker,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof DatePicker>;

// Initial dates pinned for stable snapshots; selection is stateful so both
// typing (MM/DD/YYYY or YYYY-MM-DD) and calendar picks work.
const DefaultDemo = () => {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 5, 15));

  return (
    <DatePicker
      label="Start date"
      description="Type a date or pick one from the calendar."
      value={date}
      onChange={setDate}
      className="w-72"
    />
  );
};

export const Default: Story = {
  render: () => <DefaultDemo />,
};

const BoundedDemo = () => {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 5, 15));

  return (
    <DatePicker
      label="End date"
      required
      value={date}
      onChange={setDate}
      minDate={new Date(2026, 5, 10)}
      maxDate={new Date(2026, 6, 10)}
      className="w-72"
    />
  );
};

export const WithBounds: Story = {
  render: () => <BoundedDemo />,
};

export const States: Story = {
  render: () => (
    <div className="flex w-72 flex-col gap-6">
      <DatePicker label="Disabled" disabled value={new Date(2026, 5, 15)} />
      <DatePicker
        label="With error"
        errorMessage="The end date must come after the start date."
        value={new Date(2026, 5, 15)}
      />
    </div>
  ),
};

// Calendar-only picker (no typing), matching the upstream shadcn simple
// date-picker example.
const ButtonDemo = () => {
  const [date, setDate] = useState<Date | undefined>();

  return (
    <DatePickerButton
      label="Date"
      value={date}
      onChange={setDate}
      className="w-44"
    />
  );
};

export const ButtonVariant: Story = {
  render: () => <ButtonDemo />,
};
