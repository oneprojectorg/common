import { Calendar } from '@op/sense/Calendar';
import type { DateRange } from '@op/sense/Calendar';
import { ar } from '@op/sense/CalendarLocales';
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

// Arabic RTL example (the app ships an ar dictionary): ar locale,
// Arabic-Indic numerals, rtl layout — nav chevrons flip and the week starts
// Saturday. Still the Gregorian grid, matching the app's dates.
const ArabicDemo = () => {
  const [selected, setSelected] = useState<Date | undefined>(
    new Date(2026, 5, 15),
  );

  return (
    <Calendar
      mode="single"
      dir="rtl"
      locale={ar}
      numerals="arab"
      defaultMonth={new Date(2026, 5, 1)}
      selected={selected}
      onSelect={setSelected}
      className="rounded border"
    />
  );
};

export const Arabic: Story = {
  render: () => <ArabicDemo />,
};
