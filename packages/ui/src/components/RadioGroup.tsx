'use client';

import {
  Radio as RACRadio,
  RadioGroup as RACRadioGroup,
} from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { composeTailwindRenderProps, focusRing } from '../utils';

import { Description, FieldError, Label } from './Field';

import type { ReactNode } from 'react';
import type {
  RadioGroupProps as RACRadioGroupProps,
  RadioProps,
  ValidationResult,
} from 'react-aria-components';

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
  extend: focusRing,
  base: 'size-5 rounded-full border-2 bg-neutral-100 transition-all',
  variants: {
    isSelected: {
      false: ' border group-pressed:border',
      true: ' border-[7px]  group-pressed:border',
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
        'group flex items-center gap-2 text-sm text-neutral-800 transition disabled:text-neutral-400',
      )}
    >
      {renderProps => (
        <>
          <div className={styles(renderProps)} />
          {props.children}
        </>
      )}
    </RACRadio>
  );
};
