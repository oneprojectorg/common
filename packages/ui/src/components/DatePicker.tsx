'use client';

import { parseDate } from '@internationalized/date';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DateValue } from 'react-aria-components';
import { Button as AriaButton } from 'react-aria-components';
import { LuCalendar } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { Calendar } from './Calendar';
import type { InputWithVariantsProps } from './Field';
import { Popover } from './Popover';
import { TextField } from './TextField';

export type DatePickerProps<T extends DateValue> = {
  value?: T;
  onChange?: (value: T) => void;
  minValue?: DateValue;
  maxValue?: DateValue;
  isDisabled?: boolean;
  isReadOnly?: boolean;
  isRequired?: boolean;
  className?: string;
  label?: string;
  description?: string;
  errorMessage?: string;
  placeholder?: string;
  fieldClassName?: string;
  descriptionClassName?: string;
  labelClassName?: string;
  inputProps?: InputWithVariantsProps & { className?: string };
};

export const DatePicker = <T extends DateValue>({
  label,
  description,
  errorMessage,
  placeholder = 'Select date',
  fieldClassName,
  descriptionClassName,
  labelClassName,
  isRequired,
  inputProps,
  ...props
}: DatePickerProps<T>) => {
  const initialInputValue = useMemo(() => {
    if (props.value) {
      try {
        // Add validation for the date values
        if (!props.value.year || !props.value.month || !props.value.day) {
          console.warn('DatePicker: Invalid date structure:', props.value);
          return '';
        }

        const date = new Date(
          props.value.year,
          props.value.month - 1,
          props.value.day,
        );

        // Check if the date is valid
        if (isNaN(date.getTime())) {
          console.warn('DatePicker: Invalid date created:', props.value, date);
          return '';
        }

        return date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
        });
      } catch (error) {
        console.error(
          'DatePicker: Error processing date value:',
          props.value,
          error,
        );
        return '';
      }
    }
    return '';
  }, [props.value]);

  const [inputValue, setInputValue] = useState<string>(initialInputValue);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipNextFocusRef = useRef(false);

  // Sync internal state when props.value changes
  useEffect(() => {
    setInputValue(initialInputValue);
  }, [initialInputValue]);

  const parseInputDate = useCallback((input: string): DateValue | null => {
    try {
      // Try parsing MM/DD/YYYY format
      const mmddyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(input.trim());
      if (mmddyyyy) {
        const [, month = '', day = '', year = ''] = mmddyyyy;
        if (month && day && year) {
          const date = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
          );
          if (
            date.getFullYear() === parseInt(year) &&
            date.getMonth() === parseInt(month) - 1 &&
            date.getDate() === parseInt(day)
          ) {
            return parseDate(
              `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
            );
          }
        }
      }

      // Try parsing YYYY-MM-DD format
      const yyyymmdd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(input.trim());
      if (yyyymmdd) {
        const [, year = '', month = '', day = ''] = yyyymmdd;
        if (month && day && year) {
          const date = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
          );
          if (
            date.getFullYear() === parseInt(year) &&
            date.getMonth() === parseInt(month) - 1 &&
            date.getDate() === parseInt(day)
          ) {
            return parseDate(
              `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
            );
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }, []);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      const parsedDate = parseInputDate(value);
      if (parsedDate && props.onChange) {
        props.onChange(parsedDate as T);
      }
    },
    [parseInputDate, props.onChange],
  );

  const handleCalendarChange = useCallback(
    (newValue: DateValue) => {
      if (props.onChange) {
        props.onChange(newValue as T);
      }
      if (newValue) {
        const formattedValue = new Date(
          newValue.year,
          newValue.month - 1,
          newValue.day,
        ).toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
        });
        setInputValue(formattedValue);
      }
      skipNextFocusRef.current = true;
      setIsCalendarOpen(false);
    },
    [props.onChange],
  );

  return (
    <div className="relative">
      <TextField
        ref={inputRef}
        label={label}
        description={description}
        errorMessage={errorMessage}
        fieldClassName="relative"
        descriptionClassName={descriptionClassName}
        labelClassName={labelClassName}
        isRequired={isRequired}
        value={inputValue}
        onChange={handleInputChange}
        isDisabled={props.isDisabled}
        onFocus={() => {
          if (skipNextFocusRef.current) {
            skipNextFocusRef.current = false;
            return;
          }
          setIsCalendarOpen(true);
        }}
        inputProps={{
          ...inputProps,
          className: cn('pr-10', inputProps?.className),
          placeholder: placeholder,
        }}
      >
        <AriaButton
          isDisabled={props.isDisabled}
          onPress={() => setIsCalendarOpen((open) => !open)}
          className={cn(
            'absolute top-1/2 right-1 -translate-y-1/2',
            'h-8 w-8',
            'flex cursor-pointer items-center justify-center',
            'text-neutral-black outline-hidden',
            'rounded-sm hover:bg-neutral-gray1 focus:ring-2 focus:ring-primary-teal focus:ring-offset-2',
            props.isDisabled && 'cursor-not-allowed text-lightGray',
          )}
        >
          <LuCalendar className="size-4" />
        </AriaButton>
      </TextField>
      <Popover
        isOpen={isCalendarOpen}
        onOpenChange={(open) => {
          if (!open) {
            skipNextFocusRef.current = true;
          }
          setIsCalendarOpen(open);
        }}
        className="w-62 p-0"
        placement="bottom start"
        triggerRef={inputRef}
      >
        <Calendar
          value={props.value}
          onChange={handleCalendarChange}
          minValue={props.minValue}
          maxValue={props.maxValue}
          isDisabled={props.isDisabled}
          isReadOnly={props.isReadOnly}
          errorMessage={errorMessage}
        />
      </Popover>
    </div>
  );
};
