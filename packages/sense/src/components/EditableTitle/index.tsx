'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { LuPencil } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type EditableTitleTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';

interface EditableTitleProps
  extends
    Omit<React.ComponentProps<'h2'>, 'onChange' | 'children'>,
    VariantProps<typeof editableTitleVariants> {
  /** The committed title. Update it optimistically in `onCommit`, or the old title shows until it changes. */
  value: string;
  /** Gets the trimmed title on Enter or blur; not called when it is blank or equal to the trimmed `value`. */
  onCommit: (nextValue: string) => void;
  /** Names the field while editing, and the title at rest when it is blank and has no `placeholder`. */
  label: string;
  /** Describes the title button at rest ("Budget 2027, button, Edit"). */
  editHint?: string;
  /** Wraps the title in both states; `size` sets the type separately. */
  as?: EditableTitleTag;
  /** Shown muted when there is no title yet. */
  placeholder?: string;
  /** Renders plain text, with no pencil and no tab stop. */
  disabled?: boolean;
  maxLength?: number;
}

/** A heading edited in place: Enter or blur commits, Escape or a blank value reverts. */
function EditableTitle({
  value,
  onCommit,
  label,
  editHint = 'Edit',
  as: Tag = 'h2',
  size,
  placeholder,
  disabled = false,
  maxLength,
  className,
  ...props
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const fieldRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  // Unmounting the field can fire a blur after Enter or Escape; this stops it committing again.
  const isSettledRef = React.useRef(true);
  const shouldReturnFocusRef = React.useRef(false);
  const hintId = React.useId();

  React.useEffect(() => {
    if (isEditing) {
      fieldRef.current?.focus();
      fieldRef.current?.select();
      return;
    }

    if (shouldReturnFocusRef.current) {
      shouldReturnFocusRef.current = false;
      triggerRef.current?.focus();
    }
  }, [isEditing]);

  React.useEffect(() => {
    if (disabled) {
      isSettledRef.current = true;
      setIsEditing(false);
    }
  }, [disabled]);

  const open = () => {
    setDraft(value);
    isSettledRef.current = false;
    setIsEditing(true);
  };

  const settle = () => {
    if (isSettledRef.current) {
      return false;
    }
    isSettledRef.current = true;
    setIsEditing(false);
    return true;
  };

  const commit = () => {
    if (!settle()) {
      return;
    }
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value.trim()) {
      onCommit(trimmed);
    }
  };

  const revert = () => {
    settle();
  };

  const sizeClassName = editableTitleVariants({ size });
  const boxClassName =
    '-mx-2 inline-flex max-w-full items-center gap-2 px-2 py-1';
  const titleText = <TitleText value={value} fallback={placeholder ?? label} />;

  if (disabled) {
    return (
      <Tag className={cn(sizeClassName, className)} {...props}>
        <span className={cn(boxClassName, 'min-w-0')}>{titleText}</span>
      </Tag>
    );
  }

  return (
    <Tag className={cn(sizeClassName, className)} {...props}>
      {isEditing ? (
        <span className={cn(boxClassName, 'rounded-lg ring-2 ring-ring')}>
          <Input
            ref={fieldRef}
            value={draft}
            aria-label={label}
            placeholder={placeholder}
            maxLength={maxLength}
            enterKeyHint="done"
            className={cn(
              'field-sizing-content h-auto w-auto max-w-full min-w-24 rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0',
              sizeClassName,
            )}
            onChange={(event) => setDraft(event.target.value)}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData('text/plain');
              if (!/[\r\n]/.test(pasted)) {
                return;
              }
              // Browsers differ on line breaks in a one-line field; make them spaces.
              event.preventDefault();
              const field = event.currentTarget;
              field.setRangeText(
                pasted.replace(/[\r\n]+/g, ' '),
                field.selectionStart ?? field.value.length,
                field.selectionEnd ?? field.value.length,
                'end',
              );
              setDraft(field.value);
            }}
            onKeyDown={(event) => {
              // Safari reports the Enter that ends a composition with keyCode 229 instead.
              if (event.nativeEvent.isComposing || event.keyCode === 229) {
                return;
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                shouldReturnFocusRef.current = true;
                commit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                // Keep Escape from also dismissing a dialog this sits in.
                event.stopPropagation();
                shouldReturnFocusRef.current = true;
                revert();
              }
            }}
            onBlur={() => {
              // Switching tab or window keeps the edit open.
              if (!document.hasFocus()) {
                return;
              }
              commit();
            }}
          />
          <LuPencil
            aria-hidden
            className={cn(pencilSize({ size }), 'invisible shrink-0')}
          />
        </span>
      ) : (
        <>
          <Button
            ref={triggerRef}
            variant="bare"
            aria-describedby={hintId}
            onClick={open}
            className={cn(
              boxClassName,
              'group/editable-title max-w-full justify-start rounded-lg text-start transition-colors hover:bg-accent focus-visible:bg-accent motion-reduce:transition-none',
            )}
          >
            {titleText}
            <LuPencil
              aria-hidden
              className={cn(
                pencilSize({ size }),
                'shrink-0 text-muted-foreground transition-colors group-hover/editable-title:text-foreground group-focus-visible/editable-title:text-foreground motion-reduce:transition-none',
              )}
            />
          </Button>
          <span id={hintId} hidden>
            {editHint}
          </span>
        </>
      )}
    </Tag>
  );
}

const editableTitleVariants = cva('font-serif', {
  variants: {
    size: {
      label: 'text-label',
      title: 'text-title',
      headline: 'text-headline font-light',
      display: 'text-display font-light',
    },
  },
  defaultVariants: {
    size: 'headline',
  },
});

const pencilSize = cva('', {
  variants: {
    size: {
      label: 'size-4',
      title: 'size-4',
      headline: 'size-5',
      display: 'size-6',
    },
  },
  defaultVariants: {
    size: 'headline',
  },
});

function TitleText({ value, fallback }: { value: string; fallback: string }) {
  const isBlank = value.trim() === '';

  // Truncating text takes its direction on the element, with alignment pinned to the page.
  return (
    <span
      dir="auto"
      className={cn(
        'min-w-0 truncate ltr:text-left rtl:text-right',
        isBlank && 'text-muted-foreground',
      )}
    >
      {isBlank ? fallback : value}
    </span>
  );
}

export { EditableTitle };
export type { EditableTitleProps };
