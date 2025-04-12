'use client';

import { Button as RACButton, Link as RACLink } from 'react-aria-components';
import { tv } from 'tailwind-variants';

import { Tooltip, TooltipTrigger } from './Tooltip';

import type { TooltipProps, TooltipTriggerProps } from './Tooltip';
import type { VariantProps } from 'tailwind-variants';

const buttonStyle = tv({
  base: 'text-center text-sm leading-3',
  variants: {
    variant: {
      primary: '',
      icon: 'flex items-center justify-center gap-2',
    },
    color: {
      primary:
        'bg-teal text-whiteish hover:bg-teal-400 pressed:border-teal pressed:bg-teal-200',
      secondary:
        'border border-offWhite bg-white text-charcoal hover:bg-neutral-50 pressed:bg-white',
      gradient: '',
      destructive:
        'bg-red text-whiteish hover:bg-red-400 pressed:border-red pressed:bg-red-200',
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
        'appearance-none rounded-md shadow outline-none duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lightGray pressed:shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]',
    },
    padding: {
      default: 'p-4',
      none: 'p-0',
    },
    isDisabled: {
      true: 'pointer-events-none opacity-30',
      false: '',
    },
    insetShadow: {
      true: 'inset-shadow',
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
    padding: 'default',
    surface: 'solid',
    insetShadow: false,
    backglow: false,
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
