'use client';

import { Button as RACButton, Link as RACLink } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { Tooltip, TooltipTrigger } from './Tooltip';

import type { TooltipProps, TooltipTriggerProps } from './Tooltip';
import type { VariantProps } from 'tailwind-variants';

export const buttonStyle = tv({
  base: 'appearance-none rounded-md border border-neutral-200 text-center text-sm text-white outline-none duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 pressed:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]',
  variants: {
    variant: {
      icon: 'flex items-center justify-center border-0 p-1 text-neutral-600 hover:bg-white/10 pressed:bg-white/20 pressed:text-neutral-700 disabled:bg-transparent',
    },
    color: {
      primary:
        'bg-teal border-neutral-400 hover:bg-neutral-200 focus-visible:outline-neutral-400 pressed:border-neutral-400 pressed:bg-neutral-400 pressed:hover:bg-neutral-400',
      gradient:
        'border-neutral-400 bg-gradient-to-r from-neutral-100 to-neutral-400 transition-all hover:to-neutral-400 focus-visible:outline-neutral-400',
      destructive:
        'bg-red-800 hover:bg-red-700 focus-visible:outline-neutral-600 pressed:border-red-800 pressed:bg-red-800 pressed:hover:bg-red-800',
    },
    surface: {
      solid: '',
      outline: 'bg-transparent',
      ghost: 'border-transparent bg-transparent',
    },
    pressed: {
      true: '',
      false:
        'pressed:border-neutral-100 pressed:bg-neutral-100 pressed:hover:border-neutral-100 pressed:hover:bg-neutral-100',
    },
    scaleOnPress: {
      true: 'pressed:scale-95',
      false: '',
    },
    unstyled: {
      true: '',
      false: '',
    },
    padding: {
      default: 'p-4',
      medium: 'px-4 py-2',
      none: 'p-0',
      sm: 'p-1',
    },
    isDisabled: {
      true: 'pointer-events-none opacity-30',
      false: '',
    },
    insetShadow: {
      true: 'inset-shadow border-transparent',
      false: '',
    },
    backglow: {
      true: 'relative *:z-0 before:absolute before:inset-0 before:z-[-1] before:bg-gradient-to-r before:from-neutral-200 before:to-neutral-500 before:opacity-60 before:blur-md before:transition-all before:duration-300 before:content-[""] hover:text-neutral-950 hover:before:opacity-100 hover:before:blur-lg',
      false: '',
    },
  },
  defaultVariants: {
    color: 'primary',
    pressed: true,
    padding: 'default',
    surface: 'solid',
  },
});

type ButtonVariants = VariantProps<typeof buttonStyle>;

// type ButtonProps = React.ComponentProps<typeof RACButton>;

export interface ButtonProps
  extends React.ComponentProps<typeof RACButton>,
    ButtonVariants {
  className?: string;
}

export const Button = (props: ButtonProps) => {
  const { unstyled, ...rest } = props;

  return (
    <RACButton
      {...rest}
      className={unstyled ? props.className : buttonStyle(props)}
    />
  );
};

export interface ButtonLinkProps
  extends React.ComponentProps<typeof RACLink>,
    ButtonVariants {
  className?: string;
}

export const ButtonLink = (props: ButtonLinkProps) => {
  return <RACLink {...props} className={buttonStyle(props)} />;
};

export interface ButtonTooltipProps extends ButtonProps {
  triggerProps?: Omit<TooltipTriggerProps, 'children'>;
  tooltipProps: TooltipProps;
}

export const ButtonTooltip = (props: ButtonTooltipProps) => {
  const { triggerProps, tooltipProps, ...rest } = props;

  return (
    <TooltipTrigger {...triggerProps}>
      <Button {...rest} />
      <Tooltip {...tooltipProps} />
    </TooltipTrigger>
  );
};
