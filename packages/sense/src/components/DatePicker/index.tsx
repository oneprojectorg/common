'use client';

import { format } from 'date-fns';
import * as React from 'react';
import { LuCalendar } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { RequiredAsterisk } from '../RequiredAsterisk';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { FieldDescription, FieldError, FieldLabel } from '../ui/field';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '../ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  /** Earliest selectable day (inclusive). */
  minDate?: Date;
  /** Latest selectable day (inclusive). */
  maxDate?: Date;
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
  label,
  description,
  errorMessage,
  placeholder = 'Select date',
  disabled,
  required,
  id,
  className,
}: DatePickerProps) {
  const reactId = React.useId();
  const inputId = id ?? reactId;

  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(() => formatDate(value));

  // Follow external value changes (calendar picks route through here too) —
  // but leave the text alone when it already parses to the incoming value:
  // that's our own onChange echoing back, and reformatting non-canonical
  // typed text ("7/4/2026") mid-keystroke would yank the cursor.
  React.useEffect(() => {
    setInputValue((current) =>
      parseDate(current)?.getTime() === value?.getTime()
        ? current
        : formatDate(value),
    );
  }, [value]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setInputValue(next);
    const parsed = parseDate(next);
    if (parsed) {
      onChange?.(parsed);
    }
  };

  // Reconcile on blur: canonicalize parseable text, reset garbage back to
  // the committed value so display and value can't diverge.
  const handleBlur = () => {
    setInputValue(formatDate(parseDate(inputValue) ?? value));
  };

  return (
    <div
      data-slot="date-picker"
      className={cn('flex flex-col gap-1', className)}
    >
      {label ? (
        <FieldLabel htmlFor={inputId}>
          {label}
          {required ? <RequiredAsterisk /> : null}
        </FieldLabel>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <InputGroup>
          <InputGroupInput
            id={inputId}
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleBlur}
            // No onClick open — clicking the input is for typing; the popup
            // would steal focus. Calendar opens via the icon or ArrowDown,
            // matching the upstream shadcn date-picker input example.
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setOpen(true);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            aria-invalid={errorMessage ? true : undefined}
          />
          <InputGroupAddon align="inline-end">
            <PopoverTrigger
              render={
                <InputGroupButton
                  size="icon-sm"
                  aria-label="Open calendar"
                  disabled={disabled}
                />
              }
            >
              <LuCalendar />
            </PopoverTrigger>
          </InputGroupAddon>
        </InputGroup>
        {/* Portaled outside the .sense scope — re-scope so sense tokens apply. */}
        {/* End-aligned to the calendar icon, per the upstream input example. */}
        <PopoverContent
          align="end"
          alignOffset={-8}
          sideOffset={10}
          className="sense w-auto overflow-hidden p-0"
        >
          <Calendar
            mode="single"
            selected={value}
            defaultMonth={value}
            disabled={dateBounds(minDate, maxDate)}
            onSelect={(date) => {
              onChange?.(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </div>
  );
}

interface DatePickerButtonProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  /** Earliest selectable day (inclusive). */
  minDate?: Date;
  /** Latest selectable day (inclusive). */
  maxDate?: Date;
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  /** Button text while no date is selected. */
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  className?: string;
}

/**
 * Calendar-only date picker: a button trigger, no free-text entry. Matches
 * the upstream shadcn "simple" date-picker example.
 */
function DatePickerButton({
  value,
  onChange,
  minDate,
  maxDate,
  label,
  description,
  errorMessage,
  placeholder = 'Pick a date',
  disabled,
  required,
  id,
  className,
}: DatePickerButtonProps) {
  const reactId = React.useId();
  const buttonId = id ?? reactId;

  const [open, setOpen] = React.useState(false);

  return (
    <div
      data-slot="date-picker-button"
      className={cn('flex flex-col gap-1', className)}
    >
      {label ? (
        <FieldLabel htmlFor={buttonId}>
          {label}
          {required ? <RequiredAsterisk /> : null}
        </FieldLabel>
      ) : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={buttonId}
              variant="outline"
              disabled={disabled}
              aria-invalid={errorMessage ? true : undefined}
              className={cn(
                'justify-start font-normal',
                !value && 'text-muted-foreground',
              )}
            />
          }
        >
          <LuCalendar />
          {value ? format(value, 'PPP') : <span>{placeholder}</span>}
        </PopoverTrigger>
        {/* Portaled outside the .sense scope — re-scope so sense tokens apply. */}
        <PopoverContent align="start" className="sense w-auto p-0">
          <Calendar
            mode="single"
            selected={value}
            defaultMonth={value}
            disabled={dateBounds(minDate, maxDate)}
            onSelect={(date) => {
              onChange?.(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </div>
  );
}

function formatDate(date: Date | undefined) {
  if (!date || isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

// Accepts MM/DD/YYYY or YYYY-MM-DD; returns undefined for anything else or
// impossible dates (e.g. 02/31).
function parseDate(input: string): Date | undefined {
  const trimmed = input.trim();
  const mmddyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  const yyyymmdd = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);

  let year: number, month: number, day: number;
  if (mmddyyyy) {
    [month, day, year] = [
      Number(mmddyyyy[1]),
      Number(mmddyyyy[2]),
      Number(mmddyyyy[3]),
    ];
  } else if (yyyymmdd) {
    [year, month, day] = [
      Number(yyyymmdd[1]),
      Number(yyyymmdd[2]),
      Number(yyyymmdd[3]),
    ];
  } else {
    return undefined;
  }

  const date = new Date(year, month - 1, day);
  const roundTrips =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  return roundTrips ? date : undefined;
}

function dateBounds(minDate: Date | undefined, maxDate: Date | undefined) {
  if (minDate && maxDate) {
    return { before: minDate, after: maxDate };
  }
  if (minDate) {
    return { before: minDate };
  }
  if (maxDate) {
    return { after: maxDate };
  }
  return undefined;
}

export { DatePicker, DatePickerButton };
