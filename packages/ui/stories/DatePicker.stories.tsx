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
    <div className="w-96 gap-2 flex flex-col">
      <DatePicker
        label="Event date"
        placeholder="08/06/2025"
        value={value}
        onChange={setValue}
      />
      <div className="text-sm text-neutral-gray4">
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
    <div className="w-96 gap-2 flex flex-col">
      <DatePicker
        label="Event date"
        placeholder="08/06/2025"
        value={value}
        onChange={setValue}
      />
      <div className="text-sm text-neutral-gray4">
        Selected date:{' '}
        {value ? `${value.year}-${value.month}-${value.day}` : 'None'}
      </div>
    </div>
  );
};

export const Disabled = () => {
  return (
    <div className="w-96 gap-2 flex flex-col">
      <DatePicker label="Event date" placeholder="08/06/2025" isDisabled />
    </div>
  );
};

export const ErrorState = () => {
  return (
    <div className="w-96 gap-2 flex flex-col">
      <DatePicker
        label="Event date"
        placeholder="08/06/2025"
        errorMessage="This is an error message"
      />
    </div>
  );
};
