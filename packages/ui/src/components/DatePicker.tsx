'use client';

import { CalendarIcon } from 'lucide-react';
import { DatePicker as AriaDatePicker, Button } from 'react-aria-components';
import type {
  DatePickerProps as AriaDatePickerProps,
  DateValue,
  ValidationResult,
} from 'react-aria-components';

import { cn } from '../lib/utils';
import { composeTailwindRenderProps } from '../utils';
import { Calendar } from './Calendar';
import { Dialog } from './Dialog';
import { Description, FieldError, FieldGroup, Label } from './Field';
import { Popover } from './Popover';

export type DatePickerProps<T extends DateValue> = AriaDatePickerProps<T> & {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
  placeholder?: string;
  fieldClassName?: string;
  descriptionClassName?: string;
  labelClassName?: string;
  buttonClassName?: string;
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
  buttonClassName,
  ...props
}: DatePickerProps<T>) => {
  return (
    <AriaDatePicker
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group flex flex-col gap-1',
      )}
    >
      {label && (
        <Label
          className={cn(
            labelClassName,
            'group-data-[invalid=true]:text-functional-red',
          )}
        >
          {label}
          {isRequired && <span className="text-functional-red"> *</span>}
        </Label>
      )}
      <FieldGroup className={fieldClassName}>
        <Button
          isDisabled={props.isDisabled}
          className={cn(
            'flex h-10 min-w-0 flex-1 items-center gap-2',
            'rounded-md border border-neutral-gray1',
            'px-3',
            'text-base leading-[0.5rem] text-neutral-black outline outline-0',
            'active:border-neutral-gray4 active:outline',
            'hover:border-neutral-gray2',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue',
            'disabled:border-neutral-gray2 disabled:bg-neutral-gray1 disabled:text-lightGray',
            buttonClassName,
          )}
        >
          <CalendarIcon
            className={cn(
              'size-4 text-neutral-black',
              props.isDisabled && 'text-lightGray',
            )}
          />
          <span
            className={cn(
              'flex-1 text-left text-neutral-black',
              props.isDisabled && 'text-lightGray',
            )}
          >
            {props.value
              ? new Date(
                  props.value.year,
                  props.value.month - 1,
                  props.value.day,
                ).toLocaleDateString('en-US', {
                  month: '2-digit',
                  day: '2-digit',
                  year: 'numeric',
                })
              : placeholder}
          </span>
        </Button>
      </FieldGroup>
      {description && (
        <Description className={descriptionClassName}>
          {description}
        </Description>
      )}
      <FieldError>{errorMessage}</FieldError>
      <Popover placement="bottom start">
        <Dialog>
          <Calendar
            value={props.value}
            onChange={props.onChange}
            minValue={props.minValue}
            maxValue={props.maxValue}
            isDisabled={props.isDisabled}
            isReadOnly={props.isReadOnly}
            autoFocus={props.autoFocus}
            onFocusChange={undefined}
            errorMessage={
              typeof errorMessage === 'string' ? errorMessage : undefined
            }
            className="overflow-y-clip"
          />
        </Dialog>
      </Popover>
    </AriaDatePicker>
  );
};
