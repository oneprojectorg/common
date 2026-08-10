'use client';

import * as React from 'react';
import { LuX } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { FieldDescription, FieldError, FieldLabel } from '../ui/field';

type TagSize = 'default' | 'lg';

// Badge stays upstream-pure (it has no size variant), so the size classes
// live here in the composite.
const tagSizeClasses: Record<TagSize, string> = {
  default: '',
  lg: 'h-7 px-2.5 text-sm',
};

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
  // The name belongs on the list, not on the roleless wrapper the rest of the
  // props land on — left there it is dropped and the list stays unnamed.
  'aria-label': ariaLabel,
  ...props
}: TagGroupProps) {
  // A <label> can't label a <ul>, so the group name rides aria-labelledby.
  const labelId = React.useId();
  const descriptionId = React.useId();

  return (
    <div
      data-slot="tag-group"
      className={cn('flex flex-col gap-1', className)}
      {...props}
    >
      {label ? <FieldLabel id={labelId}>{label}</FieldLabel> : null}
      <ul
        data-slot="tag-list"
        aria-label={ariaLabel}
        aria-labelledby={label ? labelId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        className="flex flex-wrap gap-2"
      >
        {children}
      </ul>
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </div>
  );
}

interface TagProps extends React.ComponentProps<typeof Badge> {
  /** Renders a remove affordance; called on click. */
  onRemove?: () => void;
  /** Accessible label for the remove button — pass a translated string. */
  removeLabel?: string;
  size?: TagSize;
}

function Tag({
  children,
  onRemove,
  removeLabel = 'Remove',
  variant = 'secondary',
  size = 'default',
  className,
  ...props
}: TagProps) {
  return (
    <li data-slot="tag" className="max-w-full list-none">
      <Badge
        variant={variant}
        className={cn('max-w-full', tagSizeClasses[size], className)}
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
            <LuX aria-hidden className={size === 'lg' ? 'size-4' : 'size-3'} />
          </button>
        ) : null}
      </Badge>
    </li>
  );
}

export { TagGroup, Tag };
