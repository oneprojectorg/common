'use client';

import { Button as RACButton, Link as RACLink } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

import { Tooltip, TooltipTrigger } from './Tooltip';
import type { TooltipProps, TooltipTriggerProps } from './Tooltip';

const buttonStyle = tv({
  base: 'gap-1 font-normal leading-3 sm:text-base flex w-fit cursor-pointer items-center justify-center rounded-md text-center text-base text-nowrap shadow-md',
  variants: {
    variant: {
      primary: '',
      icon: 'gap-2 sm:text-base flex text-sm',
      pill: 'p-2 h-auto border-0 bg-primary-tealWhite text-primary-teal hover:bg-teal-50 hover:text-primary-tealBlack focus-visible:outline-data-blue active:bg-teal-50 active:text-primary-tealBlack',
    },
    color: {
      primary:
        'bg-primary-teal text-neutral-offWhite hover:bg-primary-tealBlack pressed:bg-primary-tealBlack pressed:text-neutral-gray2',
      secondary:
        'hover:bg-neutral-50 border border-offWhite bg-white text-teal pressed:bg-white',
      gradient: '',
      unverified:
        'hover:bg-neutral-50 border border-primary-teal bg-primary-tealWhite text-teal pressed:bg-white',
      verified:
        'hover:bg-neutral-50 border border-primary-teal bg-primary-tealWhite text-teal pressed:bg-white',
      neutral:
        'hover:bg-neutral-50 border bg-white text-neutral-charcoal shadow-light pressed:bg-white',
      destructive:
        'border-functional-red bg-functional-red text-neutral-offWhite hover:bg-functional-redBlack',
      ghost:
        'border-0 bg-transparent text-midGray shadow-none hover:text-darkGray pressed:text-darkGray pressed:shadow-none',
      pill: '',
    },
    size: {
      small: 'h-8 p-3 rounded-sm',
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
        'appearance-noned outline-hidden duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lightGray pressed:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]',
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
      true: 'before:inset-0 before:from-neutral-200 before:to-neutral-500 before:blur-md hover:text-neutral-950 hover:before:blur-lg relative *:z-0 before:absolute before:z-[-1] before:bg-gradient-to-r before:opacity-60 before:transition-all before:duration-300 before:content-[""] hover:before:opacity-100',
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
