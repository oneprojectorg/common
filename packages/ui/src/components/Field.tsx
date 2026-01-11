'use client';

import type { ReactNode } from 'react';
import {
  Group,
  FieldError as RACFieldError,
  Input as RACInput,
  Label as RACLabel,
  TextArea as RACTextArea,
  Text,
  composeRenderProps,
} from 'react-aria-components';
import type {
  FieldErrorProps,
  GroupProps,
  InputProps,
  LabelProps,
  TextAreaProps,
  TextProps,
} from 'react-aria-components';
import { twMerge } from 'tailwind-merge';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

import { composeTailwindRenderProps, focusRing } from '../utils';

export const Label = (props: LabelProps) => {
  return (
    <RACLabel
      {...props}
      className={twMerge(
        'font-normal w-fit cursor-default text-sm text-neutral-black',
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
      className={twMerge(
        'text-left text-sm text-neutral-gray4',
        props.className,
      )}
    />
  );
};

export const FieldError = (props: FieldErrorProps) => {
  return (
    <RACFieldError
      {...props}
      className={composeTailwindRenderProps(
        props.className,
        'text-sm text-functional-red',
      )}
    />
  );
};

export const fieldBorderStyles = tv({
  variants: {
    isFocusWithin: {
      false: '',
      true: 'border-red',
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
  base: 'placeholder:text-teal group flex items-center bg-white disabled:placeholder:text-lightGray',
  variants: fieldBorderStyles.variants,
});

export const FieldGroup = (props: GroupProps) => {
  return (
    <Group
      {...props}
      className={composeRenderProps(props.className, (className, renderProps) =>
        fieldGroupStyles({ ...renderProps, className }),
      )}
    />
  );
};

export const inputStyles = tv({
  base: 'h-10 min-w-0 p-4 flex-1 rounded-md border border-neutral-gray1 text-base leading-[0.5rem] text-neutral-black outline outline-0 placeholder:text-neutral-gray4 hover:border-neutral-gray2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue active:border-neutral-gray4 disabled:border-neutral-gray2 disabled:bg-neutral-gray1 disabled:text-lightGray',
  variants: {
    color: {
      primary: '',
      muted: 'bg-offWhite text-neutral-gray4',
      error: 'border-functional-red outline-functional-red',
    },
    size: {
      small: 'px-4 py-2',
    },
    hasIcon: {
      true: 'pl-8 w-full',
    },
  },
  defaultVariants: {
    color: 'primary',
    hasIcon: false,
  },
});

export type InputVariantsProps = VariantProps<typeof inputStyles>;
export type InputWithVariantsProps = Omit<InputProps, 'size'> &
  InputVariantsProps & { icon?: ReactNode };

export const Input = ({
  ref,
  icon,
  size,
  ...props
}: InputWithVariantsProps & { ref?: React.RefObject<HTMLInputElement> }) => {
  if (icon) {
    return <InputWithIcon icon={icon} ref={ref} size={size} {...props} />;
  }

  return (
    <RACInput
      ref={ref}
      {...props}
      className={inputStyles({ ...props, size } as InputVariantsProps)}
    />
  );
};

export const InputWithIcon = ({
  ref,
  size,
  ...props
}: InputWithVariantsProps & { ref?: React.RefObject<HTMLInputElement> }) => {
  return (
    <span className="relative w-full">
      <RACInput
        ref={ref}
        {...props}
        className={inputStyles({
          ...props,
          size,
          hasIcon: true,
        } as InputVariantsProps)}
      />
      <span className="left-3 absolute top-1/2 -translate-y-1/2">
        {props.icon}
      </span>
    </span>
  );
};

const textAreaStyles = tv({
  base: [
    'min-w-0 p-3 w-full resize-none rounded-md border border-neutral-gray1 text-base text-neutral-black',
    'outline outline-0 placeholder:text-base placeholder:text-neutral-gray4',
    'active:border-neutral-gray4 active:outline',
    'hover:border-neutral-gray2',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue',
    'disabled:border-neutral-gray2 disabled:bg-neutral-gray1 disabled:text-lightGray',
  ],
  variants: {
    variant: {
      default: '',
      borderless: 'p-0 border-none',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
type TextAreaVariantProps = VariantProps<typeof textAreaStyles>;

export const TextArea = ({
  ref,
  variant,
  className,
  ...props
}: TextAreaProps & {
  ref?: React.RefObject<HTMLTextAreaElement>;
  className?: string;
} & TextAreaVariantProps) => {
  return (
    <RACTextArea
      ref={ref}
      {...props}
      className={textAreaStyles({ variant, className })}
    />
  );
};
