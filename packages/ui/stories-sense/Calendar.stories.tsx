import { Calendar, faIR } from '@op/sense/Calendar';
import type { DateRange } from '@op/sense/Calendar';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { withSense } from './sense';

const meta: Meta<typeof Calendar> = {
  title: 'Sense/Calendar',
  component: Calendar,
  decorators: [withSense],
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof Calendar>;

// Initial dates are pinned so Chromatic snapshots stay stable, but selection
// is stateful so pointer and keyboard interaction (Enter/Space) work.
const SingleDemo = () => {
  const [selected, setSelected] = useState<Date | undefined>(
    new Date(2026, 5, 15),
  );

  return (
    <Calendar
      mode="single"
      defaultMonth={new Date(2026, 5, 1)}
      selected={selected}
      onSelect={setSelected}
      className="rounded border"
    />
  );
};

export const Default: Story = {
  render: () => <SingleDemo />,
};

const RangeDemo = () => {
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(2025, 0, 12),
    to: new Date(2025, 1, 8),
  });

  return (
    <Calendar
      mode="range"
      numberOfMonths={2}
      defaultMonth={new Date(2025, 0)}
      selected={range}
      onSelect={setRange}
      className="rounded border"
    />
  );
};

export const Range: Story = {
  render: () => <RangeDemo />,
};

// Persian-language RTL example: faIR locale, Persian-Arabic numerals, and
// rtl layout (nav chevrons flip, week starts Saturday). Note this is still
// the Gregorian grid — a true Jalali calendar needs a date-fns-jalali
// dateLib, which react-day-picker v10 no longer bundles.
const PersianDemo = () => {
  const [selected, setSelected] = useState<Date | undefined>(
    new Date(2026, 5, 15),
  );

  return (
    <Calendar
      mode="single"
      dir="rtl"
      locale={faIR}
      numerals="arabext"
      defaultMonth={new Date(2026, 5, 1)}
      selected={selected}
      onSelect={setSelected}
      className="rounded border"
    />
  );
};

export const Persian: Story = {
  render: () => <PersianDemo />,
};
