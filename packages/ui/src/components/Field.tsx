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
        'w-fit cursor-default text-sm font-normal text-foreground',
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
        'text-left text-sm text-muted-foreground',
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
        'text-sm text-destructive',
      )}
    />
  );
};

export const fieldBorderStyles = tv({
  variants: {
    isFocusWithin: {
      false: '',
      true: 'border-destructive',
    },
    isInvalid: {
      true: 'border-destructive-300',
    },
    isDisabled: {
      true: 'border-neutral-300',
    },
  },
});

export const fieldGroupStyles = tv({
  extend: focusRing,
  base: 'group flex items-center bg-white placeholder:text-primary disabled:placeholder:text-muted-foreground/70',
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
  base: 'h-10 min-w-0 flex-1 rounded-lg border p-4 text-base leading-[0.5rem] text-foreground outline outline-0 placeholder:text-muted-foreground hover:border-input focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chart-3 active:border-input disabled:border-input disabled:bg-accent disabled:text-muted-foreground/70',
  variants: {
    color: {
      primary: '',
      muted: 'bg-muted text-muted-foreground',
      error: 'border-destructive outline-destructive',
    },
    size: {
      small: 'h-8 px-4 py-2',
    },
    hasIcon: {
      true: 'w-full pl-8',
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
  className,
  ...props
}: InputWithVariantsProps & {
  ref?: React.RefObject<HTMLInputElement>;
  className?: string;
}) => {
  if (icon) {
    return (
      <InputWithIcon
        icon={icon}
        ref={ref}
        size={size}
        className={className}
        {...props}
      />
    );
  }

  return (
    <RACInput
      ref={ref}
      {...props}
      className={inputStyles({ ...props, size, className })}
    />
  );
};

export const InputWithIcon = ({
  ref,
  size,
  className,
  ...props
}: InputWithVariantsProps & {
  ref?: React.RefObject<HTMLInputElement>;
  className?: string;
}) => {
  return (
    <span className="relative w-full">
      <RACInput
        ref={ref}
        {...props}
        className={inputStyles({
          ...props,
          size,
          hasIcon: true,
          className,
        })}
      />
      <span className="absolute top-1/2 left-3 -translate-y-1/2">
        {props.icon}
      </span>
    </span>
  );
};

const textAreaStyles = tv({
  base: [
    'w-full min-w-0 resize-none rounded-lg border p-3 text-base text-foreground',
    'outline outline-0 placeholder:text-base placeholder:text-muted-foreground',
    'active:border-input active:outline',
    'hover:border-input',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-chart-3',
    'disabled:border-input disabled:bg-accent disabled:text-muted-foreground/70',
  ],
  variants: {
    variant: {
      default: '',
      borderless: 'border-none p-0',
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
