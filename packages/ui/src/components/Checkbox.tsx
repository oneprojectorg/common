'use client';

import { Check, Minus } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Checkbox as AriaCheckbox,
  CheckboxGroup as AriaCheckboxGroup,
  composeRenderProps,
} from 'react-aria-components';
import type {
  CheckboxGroupProps as AriaCheckboxGroupProps,
  CheckboxProps,
  ValidationResult,
} from 'react-aria-components';
import { VariantProps, tv } from 'tailwind-variants';

import { composeTailwindRenderProps, focusRing } from '../utils';
import { Description, FieldError, Label } from './Field';

export interface CheckboxGroupProps
  extends Omit<AriaCheckboxGroupProps, 'children'> {
  label?: string;
  children?: ReactNode;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export const CheckboxGroup = (props: CheckboxGroupProps) => {
  return (
    <AriaCheckboxGroup
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'flex flex-col gap-2',
      )}
    >
      <Label>{props.label}</Label>
      {props.children}
      {props.description && <Description>{props.description}</Description>}
      <FieldError>{props.errorMessage}</FieldError>
    </AriaCheckboxGroup>
  );
};

const checkboxStyles = tv({
  base: 'group flex items-center gap-2 text-sm transition',
  variants: {
    isDisabled: {
      false: 'text-neutral-800',
      true: 'text-neutral-400',
    },
  },
});

const boxStyles = tv({
  extend: focusRing,
  base: 'flex size-6 flex-shrink-0 items-center justify-center rounded-sm border border-neutral-gray2 transition',
  variants: {
    isSelected: {
      false: '',
      true: 'border-none bg-teal text-neutral-offWhite',
    },
    isInvalid: {
      true: '[--color:theme(colors.red.600)] group-pressed:[--color:theme(colors.red.700)]',
    },
    isDisabled: {
      true: '[--color:theme(colors.neutral.700)]',
    },
    size: {
      small: 'size-4',
    },
  },
});

const iconStyles = 'w-4 h-4 text-neutral-100 group-disabled:text-neutral-400';

type CheckboxVariants = VariantProps<typeof boxStyles>;

export const Checkbox = (props: CheckboxProps & CheckboxVariants) => {
  return (
    <AriaCheckbox
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        checkboxStyles({ ...renderProps, className }),
      )}
    >
      {({ isSelected, isIndeterminate, ...renderProps }) => (
        <>
          <div
            className={boxStyles({
              size: props.size,
              isSelected: isSelected || isIndeterminate,
              ...renderProps,
            })}
          >
            {isIndeterminate ? (
              <Minus aria-hidden className={iconStyles} />
            ) : isSelected ? (
              <Check aria-hidden className={iconStyles} />
            ) : null}
          </div>
          {props.children}
        </>
      )}
    </AriaCheckbox>
  );
};
