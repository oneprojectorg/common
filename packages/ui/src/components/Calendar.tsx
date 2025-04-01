'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Calendar as AriaCalendar,
  CalendarGridHeader as AriaCalendarGridHeader,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarHeaderCell,
  Heading,
  Text,
  useLocale,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { focusRing } from '../utils';

import { Button } from './Button';

import type {
  CalendarProps as AriaCalendarProps,
  DateValue,
} from 'react-aria-components';

const cellStyles = tv({
  extend: focusRing,
  base: 'flex size-9 cursor-default items-center justify-center rounded-full text-sm forced-color-adjust-none',
  variants: {
    isSelected: {
      false: 'text-neutral-800 hover:bg-neutral-300 pressed:bg-neutral-400',
      true: 'bg-neutral-400 text-white invalid:bg-red-600',
    },
    isDisabled: {
      true: 'text-neutral-400',
    },
  },
});

export interface CalendarProps<T extends DateValue>
  extends Omit<AriaCalendarProps<T>, 'visibleDuration'> {
  errorMessage?: string;
}

export const CalendarHeader = () => {
  const { direction } = useLocale();

  return (
    <header className="flex w-full items-center justify-between gap-2 px-1 pb-4">
      <Button variant="icon" slot="previous">
        {direction === 'rtl'
          ? (
              <ChevronRight aria-hidden />
            )
          : (
              <ChevronLeft aria-hidden />
            )}
      </Button>
      <Heading className="text-center text-xl font-semibold text-neutral-800" />
      <Button variant="icon" slot="next">
        {direction === 'rtl'
          ? (
              <ChevronLeft aria-hidden />
            )
          : (
              <ChevronRight aria-hidden />
            )}
      </Button>
    </header>
  );
};

export const CalendarGridHeader = () => {
  return (
    <AriaCalendarGridHeader>
      {day => (
        <CalendarHeaderCell className="text-xs font-semibold text-neutral-500">
          {day}
        </CalendarHeaderCell>
      )}
    </AriaCalendarGridHeader>
  );
};

export const Calendar = <T extends DateValue>({
  errorMessage,
  ...props
}: CalendarProps<T>) => {
  return (
    <AriaCalendar {...props}>
      <CalendarHeader />
      <CalendarGrid>
        <CalendarGridHeader />
        <CalendarGridBody>
          {date => <CalendarCell date={date} className={cellStyles} />}
        </CalendarGridBody>
      </CalendarGrid>
      {errorMessage && (
        <Text slot="errorMessage" className="text-sm text-red-600">
          {errorMessage}
        </Text>
      )}
    </AriaCalendar>
  );
};
