import { Calendar } from '@op/sense/Calendar';
import type { DateRange } from '@op/sense/Calendar';
import { ar } from '@op/sense/CalendarLocales';
import { Input } from '@op/sense/Input';
import { Label } from '@op/sense/Label';
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

// Days before the (pinned) reference date are disabled — the shape of a
// "pick a future date" flow. In the app you'd pass `{ before: new Date() }`.
const DisabledDatesDemo = () => {
  const referenceDate = new Date(2026, 5, 15);
  const [selected, setSelected] = useState<Date | undefined>(undefined);

  return (
    <Calendar
      mode="single"
      defaultMonth={new Date(2026, 5, 1)}
      disabled={{ before: referenceDate }}
      selected={selected}
      onSelect={setSelected}
      className="rounded border"
    />
  );
};

export const DisabledDates: Story = {
  render: () => <DisabledDatesDemo />,
};

// Date + time: the calendar picks the day, a native time input picks the
// time. Composition mirrors the upstream shadcn date-time example.
const DateTimeDemo = () => {
  const [date, setDate] = useState<Date | undefined>(new Date(2026, 5, 15));
  const [time, setTime] = useState('10:30');

  return (
    <div className="w-fit rounded border">
      <Calendar
        mode="single"
        defaultMonth={new Date(2026, 5, 1)}
        selected={date}
        onSelect={setDate}
      />
      <div className="flex items-center gap-3 border-t p-3">
        <Label htmlFor="calendar-time" className="text-sm">
          Time
        </Label>
        <Input
          id="calendar-time"
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          className="ms-auto w-fit"
        />
      </div>
    </div>
  );
};

export const WithTimePicker: Story = {
  render: () => <DateTimeDemo />,
};

// Month and year dropdowns in the caption (upstream "Month and Year
// Selector" example) — startMonth/endMonth bound the year list.
const MonthYearSelectorDemo = () => {
  const [selected, setSelected] = useState<Date | undefined>(
    new Date(2026, 5, 15),
  );

  return (
    <Calendar
      mode="single"
      captionLayout="dropdown"
      defaultMonth={new Date(2026, 5, 1)}
      startMonth={new Date(2024, 0)}
      endMonth={new Date(2028, 11)}
      selected={selected}
      onSelect={setSelected}
      className="rounded border"
    />
  );
};

export const MonthYearSelector: Story = {
  render: () => <MonthYearSelectorDemo />,
};
