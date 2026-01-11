'use client';

import { Button as RACButton } from 'react-aria-components';
import { tv } from 'tailwind-variants';

const commentButtonStyle = tv({
  base: 'h-8 gap-1 px-2 py-1 flex cursor-pointer items-center justify-center rounded-sm bg-neutral-offWhite text-sm text-nowrap text-neutral-gray4 outline-hidden transition-colors hover:bg-neutral-gray1 hover:text-neutral-charcoal focus-visible:bg-neutral-offWhite focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-data-blue pressed:bg-neutral-gray2 pressed:text-neutral-black',
});

const iconStyle = tv({
  base: 'h-4 w-4 shrink-0',
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

export interface CommentButtonProps
  extends Omit<React.ComponentProps<typeof RACButton>, 'children'> {
  count?: number;
  className?: string;
}

export const CommentButton = ({
  count = 0,
  className,
  ...props
}: CommentButtonProps) => {
  return (
    <RACButton {...props} className={commentButtonStyle({ className })}>
      <MessageCircleIcon className={iconStyle()} />
      <span>{count} comments</span>
    </RACButton>
  );
};
