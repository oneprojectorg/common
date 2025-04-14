'use client';

import {
  composeRenderProps,
  Group,
  FieldError as RACFieldError,
  Input as RACInput,
  Label as RACLabel,
  TextArea as RACTextArea,
  Text,
} from 'react-aria-components';
import { twMerge } from 'tailwind-merge';
import { tv } from 'tailwind-variants';

import { composeTailwindRenderProps, focusRing } from '../utils';

import type {
  FieldErrorProps,
  GroupProps,
  InputProps,
  LabelProps,
  TextAreaProps,
  TextProps,
} from 'react-aria-components';

export const Label = (props: LabelProps) => {
  return (
    <RACLabel
      {...props}
      className={twMerge(
        'w-fit cursor-default text-xs font-normal text-black',
        props.className,
      )}
    />
  );
};

export const Description = (props: TextProps) => {
  return (
    <Text
      {...props}
      slot="description"
      className={twMerge('text-sm text-neutral-400', props.className)}
    />
  );
};

export const FieldError = (props: FieldErrorProps) => {
  return (
    <RACFieldError
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'text-sm text-red-600',
      )}
    />
  );
};

export const fieldBorderStyles = tv({
  variants: {
    isFocusWithin: {
      false: '',
      true: 'border-offWhite',
    },
    isInvalid: {
      true: 'border-red-300',
    },
    isDisabled: {
      true: 'border-neutral-300',
    },
  },
});

export const fieldGroupStyles = tv({
  extend: focusRing,
  base: 'group flex items-center overflow-hidden rounded-md bg-white placeholder:text-teal disabled:placeholder:text-lightGray',
  variants: fieldBorderStyles.variants,
});

export const FieldGroup = (props: GroupProps) => {
  return (
    <Group
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        fieldGroupStyles({ ...renderProps, className }))}
    />
  );
};

export const Input = ({
  ref,
  ...props
}: InputProps & { ref?: React.RefObject<HTMLInputElement> }) => {
  return (
    <RACInput
      ref={ref}
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'min-w-0 flex-1 rounded-md border border-offWhite p-4 text-sm text-black outline outline-0 placeholder:text-midGray disabled:text-lightGray',
      )}
    />
  );
};

export const TextArea = ({
  ref,
  ...props
}: TextAreaProps & { ref?: React.RefObject<HTMLTextAreaElement> }) => {
  return (
    <RACTextArea
      ref={ref}
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'min-w-0 flex-1 bg-neutral-100 px-2 py-1.5 text-sm text-neutral-900 outline outline-0 disabled:text-neutral-400',
      )}
    />
  );
};
