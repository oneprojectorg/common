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
        'gap-2 flex flex-col',
      )}
    >
      <span className="flex flex-col">
        <Label>
          {props.label}
          {props.isRequired && <span className="text-functional-red"> *</span>}
        </Label>
        {props.description && <Description>{props.description}</Description>}
      </span>
      {props.children}
      <FieldError>{props.errorMessage}</FieldError>
    </AriaCheckboxGroup>
  );
};

const checkboxStyles = tv({
  base: 'group gap-2 flex items-center text-sm transition',
  variants: {
    isDisabled: {
      false: 'text-neutral-800',
      true: 'text-neutral-400',
    },
  },
});

const boxStyles = tv({
  extend: focusRing,
  base: 'size-6 flex shrink-0 items-center justify-center rounded-sm border border-neutral-gray2 transition',
  variants: {
    isSelected: {
      false: '',
      true: 'bg-teal border-none text-neutral-offWhite',
    },
    isInvalid: {
      true: 'group-pressed:[--color:theme(colors.red.700)] [--color:theme(colors.red.600)]',
    },
    isDisabled: {
      true: '[--color:theme(colors.neutral.700)]',
    },
    size: {
      small: 'size-4',
    },
    shape: {
      square: 'rounded-sm',
      circle: 'rounded-full',
    },
    borderColor: {
      light: 'border-neutral-gray1',
      default: 'border-neutral-gray2',
    },
  },
  defaultVariants: {
    shape: 'square',
    borderColor: 'default',
  },
});

const iconStyles = tv({
  base: 'text-neutral-100 group-disabled:text-neutral-400',
  variants: {
    size: {
      small: 'h-3 w-3',
      default: 'h-4 w-4',
    },
  },
  defaultVariants: {
    size: 'default',
  },
});

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
              shape: props.shape,
              borderColor: props.borderColor,
              isSelected: isSelected || isIndeterminate,
              ...renderProps,
            })}
          >
            {isIndeterminate ? (
              <Minus aria-hidden className={iconStyles({ size: props.size })} />
            ) : isSelected ? (
              <Check aria-hidden className={iconStyles({ size: props.size })} />
            ) : null}
          </div>
          {props.children}
        </>
      )}
    </AriaCheckbox>
  );
};
