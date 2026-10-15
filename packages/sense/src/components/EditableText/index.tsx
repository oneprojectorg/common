'use client';

import * as React from 'react';
import { LuPencil } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

type EditableTextTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';

interface EditableTextProps extends Omit<
  React.ComponentProps<'h2'>,
  'onChange' | 'children'
> {
  /** The committed text. Update it optimistically in `onCommit`, or the old text shows until it changes. */
  value: string;
  /** Gets the trimmed text on Enter or blur; not called when it is blank or equal to the trimmed `value`. */
  onCommit: (nextValue: string) => void;
  /** Names the field while editing, and the text at rest when it is blank and has no `placeholder`. */
  label: string;
  /** Describes the text's button at rest ("Budget 2027, button, Edit"). */
  editHint?: string;
  /** Wraps the text in both states. Style it with `className`: the field inherits its font, letter spacing and colour. */
  as?: EditableTextTag;
  /** Sizes the pencil; it defaults to `size-4`. */
  iconClassName?: string;
  /** Shown muted when there is no text yet. */
  placeholder?: string;
  /** Renders plain text, with no pencil and no tab stop. */
  disabled?: boolean;
  maxLength?: number;
}

/** One line of text edited in place, such as a title: Enter or blur commits, Escape or a blank value reverts. */
function EditableText({
  value,
  onCommit,
  label,
  editHint = 'Edit',
  as: Tag = 'p',
  iconClassName,
  placeholder,
  disabled = false,
  maxLength,
  className,
  ...props
}: EditableTextProps) {
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

  const boxClassName =
    '-mx-2 inline-flex max-w-full items-center gap-2 px-2 py-1';
  const displayText = (
    <DisplayText value={value} fallback={placeholder ?? label} />
  );
  const iconSizeClassName = cn('size-4', iconClassName);

  if (disabled) {
    return (
      <Tag className={className} {...props}>
        <span className={cn(boxClassName, 'min-w-0')}>{displayText}</span>
      </Tag>
    );
  }

  return (
    <Tag className={className} {...props}>
      {isEditing ? (
        <span className={cn(boxClassName, 'rounded-lg ring-2 ring-ring')}>
          <Input
            ref={fieldRef}
            value={draft}
            aria-label={label}
            placeholder={placeholder}
            maxLength={maxLength}
            enterKeyHint="done"
            // Inline so it beats the Input's type classes; the field keeps the wrapper's metrics.
            style={INHERIT_TYPOGRAPHY}
            className="field-sizing-content h-auto w-auto max-w-full min-w-24 rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0"
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
            className={cn(iconSizeClassName, 'invisible shrink-0')}
          />
        </span>
      ) : (
        <>
          <Button
            ref={triggerRef}
            variant="bare"
            aria-describedby={hintId}
            onClick={open}
            style={INHERIT_TYPOGRAPHY}
            className={cn(
              boxClassName,
              'group/editable-text max-w-full justify-start rounded-lg text-start transition-colors hover:bg-accent focus-visible:bg-accent motion-reduce:transition-none',
            )}
          >
            {displayText}
            <LuPencil
              aria-hidden
              className={cn(
                'shrink-0 text-muted-foreground transition-colors group-hover/editable-text:text-foreground group-focus-visible/editable-text:text-foreground motion-reduce:transition-none',
                iconSizeClassName,
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

// Form controls reset these; inheriting them keeps both states in the wrapper's type.
const INHERIT_TYPOGRAPHY: React.CSSProperties = {
  font: 'inherit',
  letterSpacing: 'inherit',
  color: 'inherit',
};

function DisplayText({ value, fallback }: { value: string; fallback: string }) {
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

export { EditableText };
export type { EditableTextProps };
