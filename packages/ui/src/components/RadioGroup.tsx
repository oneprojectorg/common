'use client';

import type { ReactNode } from 'react';
import {
  Radio as RACRadio,
  RadioGroup as RACRadioGroup,
} from 'react-aria-components';
import type {
  RadioGroupProps as RACRadioGroupProps,
  RadioProps,
  ValidationResult,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { composeTailwindRenderProps } from '../utils';
import { Description, FieldError, Label } from './Field';

export interface RadioGroupProps extends Omit<RACRadioGroupProps, 'children'> {
  label?: string;
  children?: ReactNode;
  description?: string;
  errorMessage?: string | ((validation: ValidationResult) => string);
}

export const RadioGroup = (props: RadioGroupProps) => {
  return (
    <RACRadioGroup
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group flex flex-col gap-2',
      )}
    >
      <Label className="text-neutral-charcoal">
        {props.label}
        {props.isRequired && <span className="text-functional-red"> *</span>}
      </Label>
      <div className="group-orientation-horizontal:gap-4 group-orientation-vertical:flex-col flex gap-2">
        {props.children}
      </div>
      {props.description && <Description>{props.description}</Description>}
      <FieldError>{props.errorMessage}</FieldError>
    </RACRadioGroup>
  );
};

const styles = tv({
  // extend: focusRing,
  base: 'bg-neutral-white border-neutral-gray3 aspect-square size-4 shrink-0 rounded-full border transition-all',
  variants: {
    isSelected: {
      false:
        'group-pressed:border group-pressed:border-neutral-gray3 border-neutral-gray3 border',
      true: 'group-pressed:border group-pressed:border-primary-tealBlack border-primary-tealBlack outline-primary-teal border-[0.31rem] outline outline-1 -outline-offset-1',
    },
    isInvalid: {
      true: 'group-pressed:border-red-700 border-red-600',
    },
    isDisabled: {
      true: 'border-neutral-gray3 border',
    },
  },
});

export interface CustomRadioProps extends RadioProps {
  labelPosition?: 'right' | 'bottom';
}

export const Radio = ({
  labelPosition = 'right',
  ...props
}: CustomRadioProps) => {
  const isBottomLabel = labelPosition === 'bottom';

  return (
    <RACRadio
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        isBottomLabel
          ? 'text-neutral-charcoal group flex flex-col items-center gap-1 py-2 text-base transition'
          : 'text-neutral-charcoal group flex items-start gap-2 py-2 text-base transition',
      )}
    >
      {(renderProps) => {
        const children =
          typeof props.children === 'function'
            ? props.children(renderProps)
            : props.children;

        return (
          <>
            <div className={styles(renderProps)} />
            <span className={isBottomLabel ? 'text-center text-sm' : ''}>
              {children}
            </span>
          </>
        );
      }}
    </RACRadio>
  );
};
