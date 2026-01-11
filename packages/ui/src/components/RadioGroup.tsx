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
        'group gap-2 flex flex-col',
      )}
    >
      <Label className="text-neutral-charcoal">
        {props.label}
        {props.isRequired && <span className="text-functional-red"> *</span>}
      </Label>
      <div className="group-orientation-horizontal:gap-4 gap-2 flex group-orientation-vertical:flex-col">
        {props.children}
      </div>
      {props.description && <Description>{props.description}</Description>}
      <FieldError>{props.errorMessage}</FieldError>
    </RACRadioGroup>
  );
};

const styles = tv({
  // extend: focusRing,
  base: 'bg-neutral-white size-4 aspect-square shrink-0 rounded-full border border-neutral-gray3 transition-all',
  variants: {
    isSelected: {
      false:
        'border border-neutral-gray3 group-pressed:border group-pressed:border-neutral-gray3',
      true: 'border-[0.31rem] border-primary-tealBlack outline outline-1 -outline-offset-1 outline-primary-teal group-pressed:border group-pressed:border-primary-tealBlack',
    },
    isInvalid: {
      true: 'border-red-600 group-pressed:border-red-700',
    },
    isDisabled: {
      true: 'border border-neutral-gray3',
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
          ? 'group gap-1 py-2 flex flex-col items-center text-base text-neutral-charcoal transition'
          : 'group gap-2 py-2 flex items-start text-base text-neutral-charcoal transition',
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
