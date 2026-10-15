'use client';

import * as React from 'react';
import { LuCheck, LuPencil } from 'react-icons/lu';

import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';

type EditableTextTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p';

type FieldElement = HTMLInputElement | HTMLTextAreaElement;

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
  /** Names the button that commits the edit. */
  doneLabel?: string;
  /** Wraps the text in both states. Style it with `className`: the field inherits its font, letter spacing and colour. */
  as?: EditableTextTag;
  /** Sizes the pencil; it defaults to `size-4`. */
  iconClassName?: string;
  /** Shown muted when there is no text yet. */
  placeholder?: string;
  /** Renders plain text, with no pencil and no tab stop. */
  disabled?: boolean;
  /** Wraps long text onto more lines instead of truncating it; still one line of text, so Enter commits. */
  wrap?: boolean;
  maxLength?: number;
}

/** One line of text edited in place, such as a title: Enter, Done or focus leaving commits; Escape or a blank value reverts. */
function EditableText({
  value,
  onCommit,
  label,
  editHint = 'Edit',
  doneLabel = 'Done',
  as: Tag = 'p',
  iconClassName,
  placeholder,
  disabled = false,
  wrap = false,
  maxLength,
  className,
  ...props
}: EditableTextProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const fieldRef = React.useRef<FieldElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  // Unmounting the field can fire a blur after Enter or Escape; this stops it committing again.
  const isSettledRef = React.useRef(true);
  const shouldReturnFocusRef = React.useRef(false);
  const hintId = React.useId();

  const setFieldRef = React.useCallback((node: FieldElement | null) => {
    fieldRef.current = node;
  }, []);

  useContentHeight(fieldRef, draft, wrap && isEditing);

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

  const boxClassName = cn(
    '-mx-2 inline-flex max-w-full gap-2 px-2 py-1',
    wrap ? 'items-start' : 'items-center',
  );
  const displayText = (
    <DisplayText value={value} fallback={placeholder ?? label} wrap={wrap} />
  );
  const iconSizeClassName = cn('size-4', iconClassName);

  if (disabled) {
    return (
      <Tag className={className} {...props}>
        <span className={cn(boxClassName, 'min-w-0')}>{displayText}</span>
      </Tag>
    );
  }

  const fieldProps = {
    value: draft,
    'aria-label': label,
    placeholder,
    maxLength,
    // Inline so it beats the field's type classes; the field keeps the wrapper's metrics.
    style: INHERIT_TYPOGRAPHY,
    onChange: (event: React.ChangeEvent<FieldElement>) =>
      setDraft(event.target.value),
    onPaste: (event: React.ClipboardEvent<FieldElement>) => {
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
    },
    onKeyDown: (event: React.KeyboardEvent<FieldElement>) => {
      // Safari reports the Enter that ends a composition with keyCode 229 instead.
      if (event.nativeEvent.isComposing || event.keyCode === 229) {
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        shouldReturnFocusRef.current = true;
        commit();
      }
    },
  };
  const fieldClassName =
    'h-auto max-w-full rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0';

  return (
    <Tag className={className} {...props}>
      {isEditing ? (
        <span
          className={cn(boxClassName, 'rounded-lg ring-2 ring-ring')}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) {
              return;
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              // Keep Escape from also dismissing a dialog this sits in.
              event.stopPropagation();
              shouldReturnFocusRef.current = true;
              revert();
            }
          }}
          onBlur={(event) => {
            // Moving between the field and Done stays inside the edit.
            if (event.currentTarget.contains(event.relatedTarget)) {
              return;
            }
            // Switching tab or window keeps the edit open.
            if (!document.hasFocus()) {
              return;
            }
            commit();
          }}
        >
          {wrap ? (
            <Textarea
              ref={setFieldRef}
              rows={1}
              enterKeyHint="done"
              className={cn(
                fieldClassName,
                'field-sizing-content min-h-0 w-full resize-none overflow-hidden',
              )}
              {...fieldProps}
            />
          ) : (
            <Input
              ref={setFieldRef}
              enterKeyHint="done"
              className={cn(
                fieldClassName,
                'field-sizing-content w-auto min-w-24',
              )}
              {...fieldProps}
            />
          )}
          <FirstLine>
            <Button
              variant="bare"
              aria-label={doneLabel}
              className="-m-1 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:text-foreground"
              // Keeps focus in the field, so the click commits once with focus returned to the text.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                shouldReturnFocusRef.current = true;
                commit();
              }}
            >
              <LuCheck aria-hidden className={iconSizeClassName} />
            </Button>
          </FirstLine>
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
            <FirstLine>
              <LuPencil
                aria-hidden
                className={cn(
                  'text-muted-foreground transition-colors group-hover/editable-text:text-foreground group-focus-visible/editable-text:text-foreground motion-reduce:transition-none',
                  iconSizeClassName,
                )}
              />
            </FirstLine>
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

function DisplayText({
  value,
  fallback,
  wrap,
}: {
  value: string;
  fallback: string;
  wrap: boolean;
}) {
  const isBlank = value.trim() === '';

  // The text takes its direction on the element, with alignment pinned to the
  // page: truncation needs that, and the same pair serves wrapped text.
  return (
    <span
      dir="auto"
      className={cn(
        'min-w-0 ltr:text-left rtl:text-right',
        wrap ? 'wrap-break-word whitespace-normal' : 'truncate',
        isBlank && 'text-muted-foreground',
      )}
    >
      {isBlank ? fallback : value}
    </span>
  );
}

/** One line tall, so what it holds centres on the first line of wrapped text. */
function FirstLine({ children }: { children: React.ReactNode }) {
  return <span className="flex h-lh shrink-0 items-center">{children}</span>;
}

/** Sizes a textarea to its content where `field-sizing: content` is unsupported (Firefox). */
function useContentHeight(
  fieldRef: React.RefObject<FieldElement | null>,
  value: string,
  enabled: boolean,
) {
  React.useLayoutEffect(() => {
    if (!enabled || CSS.supports('field-sizing', 'content')) {
      return;
    }
    const field = fieldRef.current;
    if (!(field instanceof HTMLTextAreaElement)) {
      return;
    }

    const fit = () => {
      field.style.height = 'auto';
      field.style.height = `${field.scrollHeight}px`;
    };
    fit();

    window.addEventListener('resize', fit);
    return () => {
      window.removeEventListener('resize', fit);
    };
  }, [fieldRef, value, enabled]);
}

export { EditableText };
export type { EditableTextProps };
