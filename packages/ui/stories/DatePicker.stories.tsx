import { parseDate } from '@internationalized/date';
import type { Meta } from '@storybook/react-vite';
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
  const [value, setValue] = useState<DateValue | undefined>(undefined);

  return (
    <div className="flex w-96 flex-col gap-2">
      <DatePicker
        label="Event date"
        placeholder="08/06/2025"
        value={value}
        onChange={setValue}
      />
      <div className="text-neutral-gray4 text-sm">
        Selected date:{' '}
        {value ? `${value.year}-${value.month}-${value.day}` : 'None'}
      </div>
    </div>
  );
};

export const InitialValue = () => {
  const [value, setValue] = useState<DateValue | undefined>(
    () => parseDate('2020-02-03') as DateValue,
  );

  return (
    <div className="flex w-96 flex-col gap-2">
      <DatePicker
        label="Event date"
        placeholder="08/06/2025"
        value={value}
        onChange={setValue}
      />
      <div className="text-neutral-gray4 text-sm">
        Selected date:{' '}
        {value ? `${value.year}-${value.month}-${value.day}` : 'None'}
      </div>
    </div>
  );
};

export const Disabled = () => {
  return (
    <div className="flex w-96 flex-col gap-2">
      <DatePicker label="Event date" placeholder="08/06/2025" isDisabled />
    </div>
  );
};

export const ErrorState = () => {
  return (
    <div className="flex w-96 flex-col gap-2">
      <DatePicker
        label="Event date"
        placeholder="08/06/2025"
        errorMessage="This is an error message"
      />
    </div>
  );
};
