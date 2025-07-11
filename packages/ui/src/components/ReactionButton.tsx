'use client';

import { Button as RACButton } from 'react-aria-components';
import type { ButtonProps as RACButtonProps } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

const reactionButtonStyle = tv({
  base: 'flex size-8 items-center justify-center rounded-full p-1 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
  variants: {
    variant: {
      default: 'bg-neutral-50 hover:bg-neutral-100 pressed:bg-neutral-200',
      hover: 'bg-neutral-100',
      pressed: 'bg-neutral-200',
      focus: 'bg-neutral-50 ring-2 ring-blue-500 ring-offset-2',
    },
    isDisabled: {
      true: 'pointer-events-none opacity-30',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const iconStyle = tv({
  base: 'size-4 shrink-0',
});

type ReactionButtonVariants = VariantProps<typeof reactionButtonStyle>;

export interface ReactionButtonProps
  extends Omit<RACButtonProps, 'children'>,
    ReactionButtonVariants {
  className?: string;
}

function ReactionIcon() {
  return (
    <svg
      className={iconStyle()}
      fill="none"
      preserveAspectRatio="none"
      viewBox="0 0 16 16"
    >
      <g clipPath="url(#clip0_550_664)">
        <path
          d="M14.6667 7.3333V7.99997C14.6599 9.34551 14.2462 10.6575 13.4798 11.7635C12.7135 12.8695 11.6304 13.7177 10.3729 14.1967C9.11546 14.6756 7.74252 14.7628 6.43458 14.4468C5.12664 14.1308 3.94493 13.4265 3.04479 12.4263C2.14466 11.4262 1.56824 10.1771 1.39131 8.84317C1.21437 7.50929 1.44522 6.15309 2.05349 4.95286C2.66176 3.75263 3.61898 2.76455 4.79932 2.11852C5.97965 1.4725 7.32785 1.19876 8.66667 1.3333M5.33334 9.3333C5.33334 9.3333 6.33334 10.6666 8 10.6666C9.66667 10.6666 10.6667 9.3333 10.6667 9.3333M6 5.99997H6.00667M10 5.99997H10.0067M10.6667 3.3333H14.6667M12.6667 1.3333V5.3333"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_550_664">
          <rect fill="white" height="16" width="16" />
        </clipPath>
      </defs>
    </svg>
  );
}

export const ReactionButton = (props: ReactionButtonProps) => {
  const { variant, className, ...rest } = props;

  return (
    <RACButton
      {...rest}
      className={reactionButtonStyle({ variant, className })}
    >
      <ReactionIcon />
    </RACButton>
  );
};