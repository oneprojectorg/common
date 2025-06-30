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
      <Label>{props.label}</Label>
      <div className="flex gap-2 group-orientation-horizontal:gap-4 group-orientation-vertical:flex-col">
        {props.children}
      </div>
      {props.description && <Description>{props.description}</Description>}
      <FieldError>{props.errorMessage}</FieldError>
    </RACRadioGroup>
  );
};

const styles = tv({
  // extend: focusRing,
  base: 'bg-neutral-white mt-1 size-4 rounded-full border border-neutral-gray3 transition-all',
  variants: {
    isSelected: {
      false: 'border group-pressed:border',
      true: 'border-[0.31rem] border-primary-tealBlack outline outline-1 -outline-offset-1 outline-primary-teal group-pressed:border',
    },
    isInvalid: {
      true: 'border-red-600 group-pressed:border-red-700',
    },
    isDisabled: {
      true: 'border',
    },
  },
});

export const Radio = (props: RadioProps) => {
  return (
    <RACRadio
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'group flex items-start gap-2 py-2 text-base text-neutral-charcoal transition',
      )}
    >
      {(renderProps) => (
        <>
          <div className={styles(renderProps)} />
          {props.children}
        </>
      )}
    </RACRadio>
  );
};
