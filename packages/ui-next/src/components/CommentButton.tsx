'use client';

import * as React from 'react';

import { cn } from '../lib/utils';

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
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      fill="none"
    />
  </svg>
);

export interface CommentButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  count?: number;
  /** Legacy alias for onClick (RAC naming) */
  onPress?: React.MouseEventHandler<HTMLButtonElement>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Legacy alias for disabled (RAC naming) */
  isDisabled?: boolean;
}

export const CommentButton = ({
  count = 0,
  className,
  onPress,
  onClick,
  isDisabled,
  disabled,
  ...props
}: CommentButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick ?? onPress}
      disabled={disabled ?? isDisabled}
      className={cn(
        'text-muted-foreground bg-muted hover:bg-accent hover:text-foreground focus-visible:bg-muted focus-visible:outline-ring focus-visible:outline-1 focus-visible:-outline-offset-1 flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md px-2 py-1 text-sm whitespace-nowrap outline-none transition-colors',
        className,
      )}
      {...props}
    >
      <MessageCircleIcon className="size-4 shrink-0" />
      <span>{count} comments</span>
    </button>
  );
};
