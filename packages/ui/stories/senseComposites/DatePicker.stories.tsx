import { parseDate } from '@internationalized/date';
import { DatePicker } from '@op/sense/DatePicker';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { DateValue } from 'react-aria-components';

import { Pair, Section } from '../../src/comparison/Comparison';
import { DatePicker as OldDatePicker } from '../../src/components/DatePicker';

// Side-by-side of the @op/ui composite and its @op/sense port. The old
// component speaks @internationalized/date DateValue; the port speaks native
// Date (react-day-picker conventions).

const meta: Meta = {
  title: 'Sense Comparison/Composites/DatePicker',
  parameters: { layout: 'fullscreen' },
};

export default meta;

type Story = StoryObj;

const NewDemo = () => {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 5, 15));

  return (
    <DatePicker
      label="Start date"
      value={date}
      onChange={setDate}
      className="w-64"
    />
  );
};

const OldDemo = () => {
  const [date, setDate] = useState<DateValue>(parseDate('2026-06-15'));

  return (
    <div className="w-64">
      <OldDatePicker label="Start date" value={date} onChange={setDate} />
    </div>
  );
};

export const DatePickerComparison: Story = {
  name: 'DatePicker',
  render: () => (
    <div className="p-8">
      <Section title="DatePicker">
        <Pair label="Basic" old={<OldDemo />} raw={<NewDemo />} />
        <Pair
          label="Error state"
          old={
            <div className="w-64">
              <OldDatePicker
                label="End date"
                errorMessage="End must follow start."
              />
            </div>
          }
          raw={
            <DatePicker
              label="End date"
              errorMessage="End must follow start."
              className="w-64"
            />
          }
        />
      </Section>
    </div>
  ),
};
