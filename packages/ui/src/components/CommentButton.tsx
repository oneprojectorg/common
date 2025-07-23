'use client';

import { Button as RACButton } from 'react-aria-components';
import { tv } from 'tailwind-variants';
import type { VariantProps } from 'tailwind-variants';

const commentButtonStyle = tv({
  base: 'flex h-8 items-center justify-center gap-1 px-2 py-1 rounded text-xs font-normal leading-[1.5] text-nowrap outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0046c2]',
  variants: {
    variant: {
      default: 'bg-neutral-offWhite text-neutral-gray4',
      hover: 'bg-neutral-gray1 text-neutral-charcoal',
      pressed: 'bg-neutral-gray2 text-neutral-black',
      focus: 'bg-neutral-offWhite text-neutral-gray4 outline outline-2 outline-[#0046c2]',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const iconStyle = tv({
  base: 'w-4 h-4 shrink-0',
});

// Message Circle Icon SVG
const MessageCircleIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14 8C14 11.3137 11.3137 14 8 14L3 14L8 14C4.68629 14 2 11.3137 2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

type CommentButtonVariants = VariantProps<typeof commentButtonStyle>;

export interface CommentButtonProps
  extends Omit<React.ComponentProps<typeof RACButton>, 'children'>,
    CommentButtonVariants {
  count?: number;
  className?: string;
}

export const CommentButton = ({
  variant = 'default',
  count = 0,
  className,
  ...props
}: CommentButtonProps) => {
  return (
    <RACButton
      {...props}
      className={commentButtonStyle({ variant, className })}
    >
      <MessageCircleIcon className={iconStyle()} />
      <span>{count} comments</span>
    </RACButton>
  );
};