'use client';

import {
  NumberField as AriaNumberField,
  type NumberFieldProps as AriaNumberFieldProps,
  type ValidationResult,
} from 'react-aria-components';

import { cn } from '../lib/utils';
import { composeTailwindRenderProps } from '../utils';
import { Description, FieldError, FieldGroup, Input, Label } from './Field';
import type { InputWithVariantsProps } from './Field';
import { RequiredAsterisk } from './RequiredAsterisk';

export interface CurrencyFieldProps extends Omit<
  AriaNumberFieldProps,
  'formatOptions' | 'value'
> {
  /** ISO 4217 code (e.g. "USD"). Drives the symbol, grouping and decimals. */
  currency: string;
  label?: string;
  description?: string;
  /** External error message. Takes precedence over built-in validation. */
  errorMessage?: string | ((validation: ValidationResult) => string);
  inputProps?: InputWithVariantsProps & { className?: string };
  fieldClassName?: string;
  labelClassName?: string;
  /** `null` means "no amount", which is what an unanswered money field is. */
  value?: number | null;
}

/**
 * Locale-aware currency input.
 *
 * Wraps React Aria's `NumberField` with `formatOptions: { style: 'currency' }`,
 * so parsing *and* formatting follow the locale from the surrounding
 * `I18nProvider`. That matters: in `es`/`fr`/`pt` the natural way to type one
 * euro fifty is `1,50`, and a parser that only knows `.` would read it as 150.
 * React Aria owns the locale's decimal and grouping separators in both
 * directions, and supplies its own translated validation messages.
 *
 * This is deliberately separate from `NumberField`, which is a plain ASCII
 * numeric text input with a decorative `prefixText`: mixing a locale-derived
 * currency symbol with an ASCII-only parser is the bug this component exists to
 * avoid. Use `NumberField` for locale-neutral counts (max points, limits) and
 * this for money.
 *
 * React Aria renders the currency symbol inside the formatted value, so no
 * separate prefix adornment is needed.
 */
export const CurrencyField = ({
  currency,
  label,
  description,
  errorMessage,
  inputProps,
  fieldClassName,
  labelClassName,
  value,
  isRequired,
  ...props
}: CurrencyFieldProps) => {
  return (
    <AriaNumberField
      {...props}
      // `aria` rather than the default `native`: these fields live outside a
      // <form> and are gated by schema validation, so required/min should be
      // announced without the browser's own submit-blocking bubbles.
      validationBehavior="aria"
      isRequired={isRequired}
      // React Aria's NumberField takes NaN, not null, for "empty".
      value={value ?? Number.NaN}
      formatOptions={{ style: 'currency', currency }}
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
          {isRequired && <RequiredAsterisk />}
        </Label>
      )}
      <FieldGroup className={fieldClassName}>
        <Input
          {...inputProps}
          className={cn(
            inputProps?.className,
            'group-data-[invalid=true]:outline-1 group-data-[invalid=true]:outline-functional-red',
          )}
        />
      </FieldGroup>
      {description && <Description>{description}</Description>}
      <FieldError>{errorMessage}</FieldError>
    </AriaNumberField>
  );
};
