'use client';

import { getLocalTimeZone, isToday } from '@internationalized/date';
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
import type {
  CalendarProps as AriaCalendarProps,
  DateValue,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { focusRing } from '../utils';
import { Button } from './Button';

const cellStyles = tv({
  extend: focusRing,
  base: 'focus-within:outline-blueGreen hover:bg-neutral-offWhite flex size-8 cursor-default items-center justify-center text-base outline-offset-2 outline-transparent forced-color-adjust-none',
  variants: {
    isSelected: {
      false: 'text-neutral-charcoal',
      true: 'bg-primary-teal hover:bg-primary-teal text-white',
    },
    isDisabled: {
      true: 'text-neutral-gray3',
    },
    isOutsideMonth: {
      true: 'text-neutral-gray4',
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
      <Button
        variant="icon"
        slot="previous"
        className="pressed:bg-neutral-offWhite pressed:shadow-none text-neutral-charcoal hover:bg-neutral-offWhite h-8 w-8 rounded-none bg-white p-0 shadow-none"
      >
        {direction === 'rtl' ? (
          <ChevronRight className="size-4" aria-hidden />
        ) : (
          <ChevronLeft className="size-4" aria-hidden />
        )}
      </Button>
      <Heading className="text-neutral-charcoal text-center text-base" />
      <Button
        variant="icon"
        slot="next"
        className="pressed:bg-neutral-offWhite pressed:shadow-none text-neutral-charcoal hover:bg-neutral-offWhite h-8 w-8 rounded-none bg-white p-0 shadow-none"
      >
        {direction === 'rtl' ? (
          <ChevronLeft className="size-4" aria-hidden />
        ) : (
          <ChevronRight className="size-4" aria-hidden />
        )}
      </Button>
    </header>
  );
};

export const CalendarGridHeader = () => {
  return (
    <AriaCalendarGridHeader>
      {(day) => (
        <CalendarHeaderCell className="text-neutral-charcoal text-base">
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
    <AriaCalendar
      {...props}
      className="border-neutral-gray1 rounded-md border border-solid bg-white p-1"
    >
      <CalendarHeader />
      <CalendarGrid>
        <CalendarGridHeader />
        <CalendarGridBody>
          {(date) => {
            const isTodayCell = isToday(date, getLocalTimeZone());
            const cell = <CalendarCell date={date} className={cellStyles} />;

            if (isTodayCell) {
              return (
                <span className="relative flex flex-col">
                  {cell}
                  <span className="bg-primary-teal absolute bottom-1 left-0 right-0 m-auto size-1 rounded-full"></span>
                </span>
              );
            }

            return cell;
          }}
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
