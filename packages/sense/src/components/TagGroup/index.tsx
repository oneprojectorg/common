'use client';

import * as React from 'react';
import { LuX } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { FieldDescription, FieldError, FieldLabel } from '../ui/field';

interface TagGroupProps extends React.ComponentProps<'div'> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  errorMessage?: React.ReactNode;
}

function TagGroup({
  label,
  description,
  errorMessage,
  className,
  children,
  ...props
}: TagGroupProps) {
  return (
    <div
      data-slot="tag-group"
      className={cn('flex flex-col gap-1', className)}
      {...props}
    >
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <ul data-slot="tag-list" className="flex flex-wrap gap-2">
        {children}
      </ul>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </div>
  );
}

interface TagProps extends React.ComponentProps<typeof Badge> {
  /** Renders a remove affordance; called on click. */
  onRemove?: () => void;
  /** Accessible label for the remove button — pass a translated string. */
  removeLabel?: string;
}

function Tag({
  children,
  onRemove,
  removeLabel = 'Remove',
  variant = 'accent',
  className,
  ...props
}: TagProps) {
  return (
    <li data-slot="tag" className="max-w-full list-none">
      <Badge
        variant={variant}
        className={cn('max-w-full', className)}
        {...props}
      >
        <span className="truncate">{children}</span>
        {onRemove ? (
          <button
            type="button"
            aria-label={removeLabel}
            onClick={onRemove}
            className="-me-0.5 flex shrink-0 cursor-pointer items-center justify-center rounded-full p-0.5 outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <LuX aria-hidden className="size-3" />
          </button>
        ) : null}
      </Badge>
    </li>
  );
}

export { TagGroup, Tag };
