'use client';

import { Button as RACButton, Link as RACLink } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

import { Tooltip, TooltipTrigger } from './Tooltip';
import type { TooltipProps, TooltipTriggerProps } from './Tooltip';

const buttonStyle = tv({
  base: 'flex w-fit items-center justify-center gap-1 rounded-md text-center text-base font-normal leading-3 shadow-md sm:text-base',
  variants: {
    variant: {
      primary: '',
      icon: 'flex gap-2 text-sm sm:text-base',
      pill: 'h-auto border-0 bg-primary-tealWhite p-2 text-primary-teal active:bg-teal-50 active:text-primary-tealBlack hover:bg-teal-50 hover:text-primary-tealBlack focus-visible:outline-data-blue',
    },
    color: {
      primary:
        'bg-primary-teal text-neutral-offWhite hover:bg-primary-tealBlack pressed:bg-primary-tealBlack pressed:text-neutral-gray2',
      secondary:
        'border border-offWhite bg-white text-teal hover:bg-neutral-50 pressed:bg-white',
      gradient: '',
      unverified:
        'border border-primary-teal bg-primary-tealWhite text-teal hover:bg-neutral-50 pressed:bg-white',
      verified:
        'border border-primary-teal bg-primary-tealWhite text-teal hover:bg-neutral-50 pressed:bg-white',
      neutral:
        'border border-neutral-gray1 bg-white text-neutral-charcoal shadow-light hover:bg-neutral-50 pressed:bg-white',
      destructive:
        'border-functional-red bg-functional-red text-neutral-offWhite hover:bg-functional-redBlack',
      ghost:
        'border-0 bg-transparent text-neutral-600 shadow-none hover:text-neutral-900',
      pill: '',
    },
    size: {
      small: 'h-8 rounded-sm p-3',
      medium: 'h-10 p-4',
    },
    surface: {
      solid: '',
      outline: 'bg-transparent',
      ghost: 'border-transparent bg-transparent',
    },
    scaleOnPress: {
      true: 'pressed:scale-95',
      false: '',
    },
    unstyled: {
      true: '',
      false:
        'appearance-noned outline-none duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lightGray pressed:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]',
    },

    isDisabled: {
      true: 'pointer-events-none opacity-30',
      false: '',
    },
    insetShadow: {
      true: '',
      false: '',
    },
    backglow: {
      true: 'relative *:z-0 before:absolute before:inset-0 before:z-[-1] before:bg-gradient-to-r before:from-neutral-200 before:to-neutral-500 before:opacity-60 before:blur-md before:transition-all before:duration-300 before:content-[""] hover:text-neutral-950 hover:before:opacity-100 hover:before:blur-lg',
      false: '',
    },
  },

  defaultVariants: {
    variant: 'primary',
    color: 'primary',
    surface: 'solid',
    insetShadow: false,
    backglow: false,
    size: 'medium',
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
