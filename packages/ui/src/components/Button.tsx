'use client';

import { Button as RACButton, Link as RACLink } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

import { Tooltip, TooltipTrigger } from './Tooltip';
import type { TooltipProps, TooltipTriggerProps } from './Tooltip';

const buttonStyle = tv({
  base: 'flex w-fit cursor-pointer items-center justify-center gap-1 text-nowrap rounded-md text-center text-base font-normal leading-3 shadow-md sm:text-base',
  variants: {
    variant: {
      primary: '',
      icon: 'flex gap-2 text-sm sm:text-base',
      pill: 'bg-primary-tealWhite text-primary-teal hover:text-primary-tealBlack focus-visible:outline-data-blue active:text-primary-tealBlack h-auto border-0 p-2 hover:bg-teal-50 active:bg-teal-50',
    },
    color: {
      primary:
        'pressed:bg-primary-tealBlack pressed:text-neutral-gray2 bg-primary-teal text-neutral-offWhite hover:bg-primary-tealBlack',
      secondary:
        'text-teal pressed:bg-white border-offWhite border bg-white hover:bg-neutral-50',
      gradient: '',
      unverified:
        'text-teal pressed:bg-white border-primary-teal bg-primary-tealWhite border hover:bg-neutral-50',
      verified:
        'text-teal pressed:bg-white border-primary-teal bg-primary-tealWhite border hover:bg-neutral-50',
      neutral:
        'pressed:bg-white border-neutral-gray1 text-neutral-charcoal shadow-light border bg-white hover:bg-neutral-50',
      destructive:
        'border-functional-red bg-functional-red text-neutral-offWhite hover:bg-functional-redBlack',
      ghost:
        'pressed:text-darkGray pressed:shadow-none text-midGray hover:text-darkGray border-0 bg-transparent shadow-none',
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
        'appearance-noned pressed:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] outline-hidden focus-visible:outline-lightGray duration-200 focus-visible:outline-2 focus-visible:outline-offset-2',
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

  compoundVariants: [
    {
      color: 'ghost',
      unstyled: false,
      className: 'pressed:!shadow-none',
    },
  ],

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
