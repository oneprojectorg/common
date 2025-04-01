'use client';

import {
  DateField as AriaDateField,
  DateInput as AriaDateInput,
  DateSegment,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { composeTailwindRenderProps } from '../utils';

import { Description, FieldError, fieldGroupStyles, Label } from './Field';

import type {
  DateFieldProps as AriaDateFieldProps,
  DateInputProps,
  DateValue,
  ValidationResult,
} from 'react-aria-components';

const segmentStyles = tv({
  base: 'inline rounded p-0.5 text-neutral-800 caret-transparent outline outline-0 forced-color-adjust-none type-literal:px-0',
  variants: {
    isPlaceholder: {
      true: 'italic text-neutral-600',
    },
    isDisabled: {
      true: 'text-neutral-400',
    },
    isFocused: {
      true: 'bg-neutral-400 text-white',
    },
  },
});

export const DateInput = (props: Omit<DateInputProps, 'children'>) => {
  return (
    <AriaDateInput
      className={renderProps =>
        fieldGroupStyles({
          ...renderProps,
          class: 'block min-w-[150px] px-2 py-1.5 text-sm',
        })}
      {...props}
    >
      {segment => <DateSegment segment={segment} className={segmentStyles} />}
    </AriaDateInput>
  );
};

export interface DateFieldProps<T extends DateValue>
  extends AriaDateFieldProps<T> {
  label?: string;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export const DateField = <T extends DateValue>({
  label,
  description,
  errorMessage,
  ...props
}: DateFieldProps<T>) => {
  return (
    <AriaDateField
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'flex flex-col gap-1',
      )}
    >
      {label && <Label>{label}</Label>}
      <DateInput />
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaDateField>
  );
};
