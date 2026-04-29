'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Calendar as AriaCalendar,
  CalendarGridHeader as AriaCalendarGridHeader,
  CalendarProps as AriaCalendarProps,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarHeaderCell,
  DateValue,
  Heading,
  Text,
  useLocale,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { cn, focusRing } from '../../lib/utils';
import { Button } from './button';

export const cellStyles = tv({
  extend: focusRing,
  base: 'mt-1 flex h-8 w-8 cursor-default items-center justify-center rounded-md text-sm font-normal transition-[box-shadow] forced-color-adjust-none',
  variants: {
    isSelected: {
      false: 'hover:bg-accent hover:text-accent-foreground',
      true: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
    },
    isDisabled: {
      true: 'text-muted-foreground opacity-50',
    },
    isOutsideMonth: {
      true: 'text-muted-foreground opacity-50',
    },
    isPressed: {
      true: 'border-ring ring-[3px] ring-ring/50',
    },
    isUnavailable: {
      true: 'text-muted-foreground opacity-50',
    },
  },
});

export interface CalendarProps<T extends DateValue> extends Omit<
  AriaCalendarProps<T>,
  'visibleDuration'
> {
  errorMessage?: string;
  className?: string;
}

export function Calendar<T extends DateValue>({
  errorMessage,
  className,
  ...props
}: CalendarProps<T>) {
  return (
    <AriaCalendar
      className={cn('flex w-fit flex-col gap-3 bg-card p-3', className)}
      {...props}
    >
      <CalendarHeader />
      <CalendarGrid className="mt-1 w-full border-collapse space-y-1">
        <CalendarGridHeader />
        <CalendarGridBody>
          {(date) => <CalendarCell date={date} className={cellStyles} />}
        </CalendarGridBody>
      </CalendarGrid>
      {errorMessage && (
        <Text slot="errorMessage" className="text-sm text-destructive">
          {errorMessage}
        </Text>
      )}
    </AriaCalendar>
  );
}

export function CalendarHeader() {
  const { direction } = useLocale();

  return (
    <header className="flex w-full items-center justify-between">
      <Button variant="outline" size="icon" className="h-7 w-7" slot="previous">
        {direction === 'rtl' ? (
          <ChevronRight aria-hidden className="h-4 w-4" />
        ) : (
          <ChevronLeft aria-hidden className="h-4 w-4" />
        )}
      </Button>
      <Heading className="text-sm font-medium" />
      <Button variant="outline" size="icon" className="h-7 w-7" slot="next">
        {direction === 'rtl' ? (
          <ChevronLeft aria-hidden className="h-4 w-4" />
        ) : (
          <ChevronRight aria-hidden className="h-4 w-4" />
        )}
      </Button>
    </header>
  );
}

export function CalendarGridHeader() {
  return (
    <AriaCalendarGridHeader>
      {(day) => (
        <CalendarHeaderCell className="w-9 text-[0.8rem] font-normal text-muted-foreground">
          {day}
        </CalendarHeaderCell>
      )}
    </AriaCalendarGridHeader>
  );
}
