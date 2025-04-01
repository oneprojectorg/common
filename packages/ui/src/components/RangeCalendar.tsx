
'use client';

import {
  RangeCalendar as AriaRangeCalendar,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  Text,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { focusRing } from '../utils';

import { CalendarGridHeader, CalendarHeader } from './Calendar';

import type {
  RangeCalendarProps as AriaRangeCalendarProps,
  DateValue,
} from 'react-aria-components';

export interface RangeCalendarProps<T extends DateValue>
  extends Omit<AriaRangeCalendarProps<T>, 'visibleDuration'> {
  errorMessage?: string;
}

const cell = tv({
  extend: focusRing,
  base: 'flex size-full items-center justify-center rounded-full text-neutral-800 forced-color-adjust-none',
  variants: {
    selectionState: {
      none: 'group-hover:bg-neutral-300 group-pressed:bg-neutral-400',
      middle: [
        'group-hover:bg-neutral-100',
        'group-invalid:group-hover:bg-red-900',
        'group-pressed:bg-neutral-200',
        'group-invalid:group-pressed:bg-red-800',
      ],
      cap: 'bg-neutral-400 text-white group-invalid:bg-red-600',
    },
    isDisabled: {
      true: 'text-neutral-400',
    },
  },
});

export const RangeCalendar = <T extends DateValue>({
  errorMessage,
  ...props
}: RangeCalendarProps<T>) => {
  return (
    <AriaRangeCalendar {...props}>
      <CalendarHeader />
      <CalendarGrid className="[&_td]:px-0">
        <CalendarGridHeader />
        <CalendarGridBody>
          {date => (
            <CalendarCell
              date={date}
              className="group size-9 cursor-default text-sm outline outline-0 outside-month:text-neutral-700 selected:bg-neutral-300/30 invalid:selected:bg-red-700/30 selection-start:rounded-s-full selection-end:rounded-e-full [td:first-child_&]:rounded-s-full [td:last-child_&]:rounded-e-full"
            >
              {({
                formattedDate,
                isSelected,
                isSelectionStart,
                isSelectionEnd,
                // isFocusVisible,
                isDisabled,
              }) => (
                <span
                  className={cell({
                    selectionState:
                      isSelected && (isSelectionStart || isSelectionEnd)
                        ? 'cap'
                        : isSelected
                          ? 'middle'
                          : 'none',
                    isDisabled,
                    // isFocusVisible,
                  })}
                >
                  {formattedDate}
                </span>
              )}
            </CalendarCell>
          )}
        </CalendarGridBody>
      </CalendarGrid>
      {errorMessage && (
        <Text slot="errorMessage" className="text-sm text-red-600">
          {errorMessage}
        </Text>
      )}
    </AriaRangeCalendar>
  );
};
