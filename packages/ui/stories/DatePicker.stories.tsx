import { parseDate } from '@internationalized/date';
import type { Meta } from '@storybook/react';
import { useState } from 'react';
import type { DateValue } from 'react-aria-components';

import { DatePicker } from '../src/components/DatePicker';

const meta: Meta<typeof DatePicker> = {
  component: DatePicker,
  tags: ['autodocs'],
  args: {
    label: 'Event date',
  },
};

export default meta;

export const Example = () => {
  const [value, setValue] = useState<DateValue | null>(null);

  return (
    <div className="flex w-96 flex-col gap-2">
      <DatePicker label="Event date" value={value} onChange={setValue} />
      <div className="text-sm text-neutral-gray4">
        Selected date:{' '}
        {value ? `${value.year}-${value.month}-${value.day}` : 'None'}
      </div>
    </div>
  );
};

export const InitialValue = () => {
  const [value, setValue] = useState<DateValue | null>(
    () => parseDate('2020-02-03') as unknown as DateValue,
  );

  return (
    <div className="flex w-96 flex-col gap-2">
      <DatePicker label="Event date" value={value} onChange={setValue} />
      <div className="text-sm text-neutral-gray4">
        Selected date:{' '}
        {value ? `${value.year}-${value.month}-${value.day}` : 'None'}
      </div>
    </div>
  );
};

export const Disabled = () => {
  return (
    <div className="flex w-96 flex-col gap-2">
      <DatePicker label="Event date" isDisabled />
    </div>
  );
};
