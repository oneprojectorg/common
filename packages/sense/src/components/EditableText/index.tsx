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
  /** Gets the trimmed text on Enter, Done or focus leaving; not called when it is blank or equal to the trimmed `value`. */
  onCommit: (nextValue: string) => void;
  /** Names the field while editing, and the text at rest when it is blank and has no `placeholder`. */
  label: string;
  /** Names the button at rest, with the text ("Edit Budget 2027"). */
  editHint?: string;
  /** Names the same button while editing. */
  doneLabel?: string;
  /** The element around the text. Style it with `className`: the text and the field take the same type. */
  as?: EditableTextTag;
  /** Sizes the pencil and the check; they default to `size-4`. */
  iconClassName?: string;
  /** Shown muted when there is no text yet. */
  placeholder?: string;
  /** Renders plain text, with no button. */
  disabled?: boolean;
  /** Wraps long text onto more lines instead of truncating it; still one line of text, so Enter commits. */
  wrap?: boolean;
  maxLength?: number;
}

/** One line of text edited in place, such as a title. One button opens the edit and then commits it; Enter also commits, Escape or a blank value reverts. */
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
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const textId = React.useId();
  const hintId = React.useId();
  const editing = isEditing && !disabled;

  const setFieldRef = React.useCallback((node: FieldElement | null) => {
    fieldRef.current = node;
    node?.focus();
    node?.select();
  }, []);

  useContentHeight(fieldRef, draft, wrap && editing);

  const open = () => {
    setDraft(value);
    setIsEditing(true);
  };

  const commit = () => {
    setIsEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value.trim()) {
      onCommit(trimmed);
    }
  };

  // Focus moves to the button before the field unmounts, so leaving never fires a second blur.
  const commitAndFocus = () => {
    buttonRef.current?.focus();
    commit();
  };

  const boxClassName = cn(
    'relative isolate -mx-2 flex w-fit max-w-full gap-2 rounded-lg px-2 py-1',
    wrap ? 'items-start' : 'items-center',
    className,
  );
  const iconSizeClassName = cn('size-4', iconClassName);
  const text = (
    <DisplayText
      id={textId}
      value={value}
      fallback={placeholder ?? label}
      wrap={wrap}
    />
  );

  if (disabled) {
    return (
      <div className={boxClassName}>
        <Tag className="min-w-0" {...props}>
          {text}
        </Tag>
      </div>
    );
  }

  const fieldClassName =
    'h-auto max-w-full rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:border-0 focus-visible:ring-0';
  const fieldProps = {
    value: draft,
    'aria-label': label,
    placeholder,
    maxLength,
    // Inline so it beats the field's type classes; the field keeps the box's metrics.
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
  };

  return (
    <div
      className={cn(boxClassName, editing && 'ring-2 ring-ring')}
      onKeyDown={(event) => {
        // Safari reports the Enter that ends a composition with keyCode 229 instead.
        if (
          !editing ||
          event.nativeEvent.isComposing ||
          event.keyCode === 229
        ) {
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          // Keep Escape from also dismissing a dialog this sits in.
          event.stopPropagation();
          buttonRef.current?.focus();
          setIsEditing(false);
        } else if (event.key === 'Enter' && event.target === fieldRef.current) {
          event.preventDefault();
          commitAndFocus();
        }
      }}
      onBlur={(event) => {
        // Moving between the field and the button stays inside the edit.
        if (!editing || event.currentTarget.contains(event.relatedTarget)) {
          return;
        }
        // Switching tab or window keeps the edit open.
        if (!document.hasFocus()) {
          return;
        }
        commit();
      }}
    >
      <Tag className="min-w-0" {...props}>
        {!editing ? (
          text
        ) : wrap ? (
          <Textarea
            ref={setFieldRef}
            rows={1}
            enterKeyHint="done"
            className={cn(
              fieldClassName,
              'min-h-0 w-full resize-none overflow-hidden',
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
      </Tag>
      {/* One line tall, so the button centres on the first line of wrapped text. */}
      <span className="flex h-lh shrink-0 items-center">
        <Button
          ref={buttonRef}
          variant="bare"
          aria-labelledby={editing ? undefined : `${hintId} ${textId}`}
          aria-label={editing ? doneLabel : undefined}
          className={cn(
            '-m-1 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground motion-reduce:transition-none',
            // At rest the button covers the whole box, so the text is the click target and carries the hover and focus styles.
            !editing &&
              'static after:absolute after:inset-0 after:-z-10 after:rounded-lg after:transition-colors hover:after:bg-accent focus-visible:ring-0 focus-visible:after:bg-accent focus-visible:after:ring-3 focus-visible:after:ring-ring/50 active:not-aria-[haspopup]:translate-none motion-reduce:after:transition-none',
          )}
          // Keeps focus in the field on press, so the click commits once.
          onMouseDown={editing ? (event) => event.preventDefault() : undefined}
          onClick={editing ? commitAndFocus : open}
        >
          {editing ? (
            <LuCheck aria-hidden className={iconSizeClassName} />
          ) : (
            <LuPencil aria-hidden className={iconSizeClassName} />
          )}
        </Button>
      </span>
      <span id={hintId} hidden>
        {editHint}
      </span>
    </div>
  );
}

// Form controls reset these; inheriting them keeps the field in the box's type.
const INHERIT_TYPOGRAPHY: React.CSSProperties = {
  font: 'inherit',
  letterSpacing: 'inherit',
  color: 'inherit',
};

function DisplayText({
  id,
  value,
  fallback,
  wrap,
}: {
  id: string;
  value: string;
  fallback: string;
  wrap: boolean;
}) {
  const isBlank = value.trim() === '';

  // The text takes its direction on the element, with alignment pinned to the
  // page: truncation needs that, and the same pair serves wrapped text.
  return (
    <span
      id={id}
      dir="auto"
      className={cn(
        'block min-w-0 ltr:text-left rtl:text-right',
        wrap ? 'wrap-break-word whitespace-normal' : 'truncate',
        isBlank && 'text-muted-foreground',
      )}
    >
      {isBlank ? fallback : value}
    </span>
  );
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
