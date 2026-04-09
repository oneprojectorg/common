'use client';

import { Button as RACButton, Link as RACLink } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

import { cn } from '../lib/utils';
import { LoadingSpinner } from './LoadingSpinner';
import { Tooltip, TooltipTrigger } from './Tooltip';
import type { TooltipProps, TooltipTriggerProps } from './Tooltip';

const buttonStyle = tv({
  base: 'flex w-fit cursor-pointer items-center justify-center gap-1 rounded-lg text-center text-base leading-3 font-normal text-nowrap shadow-md sm:text-base',
  variants: {
    variant: {
      primary: '',
      icon: 'flex gap-2 text-sm sm:text-base',
      pill: 'h-auto border-0 bg-primary-tealWhite p-2 text-primary-teal shadow-none hover:bg-teal-50 hover:text-primary-tealBlack focus-visible:outline-data-blue active:bg-teal-50 active:text-primary-tealBlack',
      link: 'border-0 bg-transparent text-primary-teal shadow-none hover:underline pressed:underline',
    },
    color: {
      primary:
        'bg-primary-teal text-neutral-offWhite hover:bg-primary-tealBlack pressed:bg-primary-tealBlack pressed:text-neutral-gray2',
      secondary:
        'border border-neutral-gray1 bg-white text-neutral-black shadow-light hover:bg-neutral-offWhite pressed:bg-neutral-gray1',
      gradient: '',
      unverified:
        'border border-primary-teal bg-primary-tealWhite text-teal hover:bg-neutral-offWhite pressed:bg-white',
      verified:
        'border border-primary-teal bg-primary-tealWhite text-teal hover:bg-neutral-offWhite pressed:bg-white',
      neutral:
        'border border-neutral-gray1 bg-white text-neutral-charcoal shadow-light hover:bg-neutral-offWhite pressed:bg-white',
      destructive:
        'border-functional-red bg-functional-red text-neutral-offWhite hover:bg-functional-redBlack',
      ghost:
        'border-0 bg-transparent text-midGray shadow-none hover:text-darkGray pressed:text-darkGray pressed:shadow-none',
      pill: '',
    },
    size: {
      small: 'h-8 rounded-md p-3',
      medium: 'h-10 p-4',
      inline: 'inline-block h-auto p-0',
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
        'appearance-noned outline-hidden duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-data-blue pressed:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)]',
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
      true: 'relative *:z-0 before:absolute before:inset-0 before:z-[-1] before:bg-gradient-to-r before:from-neutral-gray1 before:to-neutral-gray3 before:opacity-60 before:blur-md before:transition-all before:duration-300 before:content-[""] hover:text-neutral-black hover:before:opacity-100 hover:before:blur-lg',
      false: '',
    },
  },

  compoundVariants: [
    {
      color: 'ghost',
      unstyled: false,
      className: 'pressed:!shadow-none',
    },
    {
      variant: 'link',
      unstyled: false,
      className:
        'bg-transparent text-primary-teal shadow-none hover:bg-transparent pressed:bg-transparent pressed:text-primary-teal pressed:!shadow-none',
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
  isLoading?: boolean;
}

export const Button = (props: ButtonProps) => {
  const { unstyled, isLoading, ...rest } = props;

  const className = unstyled
    ? props.className
    : buttonStyle({
        ...props,
        isDisabled: isLoading ? false : props.isDisabled,
        className: isLoading
          ? cn(props.className, 'relative')
          : props.className,
      });

  if (!isLoading) {
    return <RACButton {...rest} className={className} />;
  }

  const { children, ...buttonRest } = rest;

  return (
    <RACButton {...buttonRest} isPending className={className}>
      {(renderProps) => (
        <>
          <span className="invisible flex items-center gap-1">
            {typeof children === 'function' ? children(renderProps) : children}
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <LoadingSpinner
              className={cn(
                'fill-transparent text-current',
                props.size === 'small' ? 'size-4' : 'size-5',
              )}
            />
          </span>
        </>
      )}
    </RACButton>
  );
};

type LowLevelPressHandlers =
  | 'onPressStart'
  | 'onPressEnd'
  | 'onPressChange'
  | 'onPressUp';

export interface ButtonLinkProps
  extends Omit<React.ComponentProps<typeof RACLink>, LowLevelPressHandlers>,
    ButtonVariants {
  className?: string;
  isLoading?: boolean;
}

export const ButtonLink = (props: ButtonLinkProps) => {
  const { isLoading, ...rest } = props;

  const className = buttonStyle({
    ...props,
    isDisabled: isLoading ? false : props.isDisabled,
    className: isLoading ? cn(props.className, 'relative') : props.className,
  });

  if (!isLoading) {
    return <RACLink {...rest} className={className} />;
  }

  const { children, onPress: _onPress, ...linkRest } = rest;

  return (
    <RACLink
      {...linkRest}
      aria-busy="true"
      aria-disabled="true"
      className={className}
    >
      {(renderProps) => (
        <>
          <span className="invisible flex items-center gap-1">
            {typeof children === 'function' ? children(renderProps) : children}
          </span>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <LoadingSpinner
              className={cn(
                'fill-transparent text-current',
                props.size === 'small' ? 'size-4' : 'size-5',
              )}
            />
          </span>
        </>
      )}
    </RACLink>
  );
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
