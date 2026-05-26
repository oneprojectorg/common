'use client';

import * as React from 'react';
import { LuCalendar } from 'react-icons/lu';

import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Field, FieldDescription, FieldError, FieldLabel } from './ui/field';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

export interface DatePickerProps {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
  isRequired?: boolean;
  value?: Date;
  defaultValue?: Date;
  onChange?: (value: Date) => void;
  minValue?: Date;
  maxValue?: Date;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

const formatDisplay = (date: Date) =>
  date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export function DatePicker({
  label,
  description,
  errorMessage,
  isRequired,
  value,
  defaultValue,
  onChange,
  minValue,
  maxValue,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const [internalValue, setInternalValue] = React.useState<Date | undefined>(
    defaultValue,
  );
  const [open, setOpen] = React.useState(false);

  const resolved = value !== undefined ? value : internalValue;
  const isInvalid = Boolean(errorMessage);

  const handleSelect = (next: Date | undefined) => {
    if (!next) {
      return;
    }
    if (value === undefined) {
      setInternalValue(next);
    }
    onChange?.(next);
    setOpen(false);
  };

  const disabled = React.useMemo(() => {
    const constraints: Array<(date: Date) => boolean> = [];
    if (minValue) {
      const min = new Date(minValue);
      min.setHours(0, 0, 0, 0);
      constraints.push((d) => d < min);
    }
    if (maxValue) {
      const max = new Date(maxValue);
      max.setHours(0, 0, 0, 0);
      constraints.push((d) => d > max);
    }
    if (constraints.length === 0) {
      return undefined;
    }
    return (d: Date) => constraints.some((fn) => fn(d));
  }, [minValue, maxValue]);

  return (
    <Field
      data-invalid={isInvalid || undefined}
      className={cn('gap-2', className)}
    >
      {label && (
        <FieldLabel>
          {label}
          {isRequired && <span className="text-destructive"> *</span>}
        </FieldLabel>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              aria-label={ariaLabel}
              aria-invalid={isInvalid || undefined}
              className={cn(
                'w-full justify-start text-left font-normal',
                !resolved && 'text-muted-foreground',
              )}
            />
          }
        >
          <LuCalendar className="size-4" />
          {resolved ? formatDisplay(resolved) : (placeholder ?? 'Pick a date')}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={resolved}
            onSelect={handleSelect}
            disabled={disabled}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      {description && !errorMessage && (
        <FieldDescription>{description}</FieldDescription>
      )}
      {errorMessage && <FieldError>{errorMessage}</FieldError>}
    </Field>
  );
}
