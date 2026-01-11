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
  base: 'focus-within:outline-blueGreen size-8 flex cursor-default items-center justify-center text-base outline-offset-2 outline-transparent forced-color-adjust-none hover:bg-neutral-offWhite',
  variants: {
    isSelected: {
      false: 'text-neutral-charcoal',
      true: 'bg-primary-teal text-white hover:bg-primary-teal',
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
    <header className="gap-2 px-1 pb-4 flex w-full items-center justify-between">
      <Button
        variant="icon"
        slot="previous"
        className="h-8 w-8 p-0 rounded-none bg-white text-neutral-charcoal shadow-none hover:bg-neutral-offWhite pressed:bg-neutral-offWhite pressed:shadow-none"
      >
        {direction === 'rtl' ? (
          <ChevronRight className="size-4" aria-hidden />
        ) : (
          <ChevronLeft className="size-4" aria-hidden />
        )}
      </Button>
      <Heading className="text-center text-base text-neutral-charcoal" />
      <Button
        variant="icon"
        slot="next"
        className="h-8 w-8 p-0 rounded-none bg-white text-neutral-charcoal shadow-none hover:bg-neutral-offWhite pressed:bg-neutral-offWhite pressed:shadow-none"
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
        <CalendarHeaderCell className="text-base text-neutral-charcoal">
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
      className="p-1 rounded-md border border-solid bg-white"
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
                  <span className="bottom-1 left-0 right-0 size-1 absolute m-auto rounded-full bg-primary-teal"></span>
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
