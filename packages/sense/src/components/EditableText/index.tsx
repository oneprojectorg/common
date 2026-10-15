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
  /** Names the button at rest, before the text ("Edit Budget 2027"). */
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

  // Disabling mid-edit closes it, so re-enabling does not reopen a stale draft.
  if (disabled && isEditing) {
    setIsEditing(false);
  }

  const setFieldRef = React.useCallback((node: FieldElement | null) => {
    fieldRef.current = node;
    node?.focus();
    node?.select();
  }, []);

  useContentHeight(fieldRef, draft, wrap && isEditing);

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

  const isBlank = value.trim() === '';
  const shownText = isBlank ? (placeholder ?? label) : value;
  const boxClassName = cn(
    'relative -mx-2 flex w-fit max-w-full gap-2 rounded-lg px-2 py-1',
    wrap ? 'items-start' : 'items-center',
    className,
  );
  const text = <DisplayText muted={isBlank} wrap={wrap} text={shownText} />;

  if (disabled) {
    return (
      <div className={boxClassName}>
        <Tag className="min-w-0" {...props}>
          {text}
        </Tag>
      </div>
    );
  }

  const Icon = isEditing ? LuCheck : LuPencil;
  const fieldProps = {
    ref: setFieldRef,
    value: draft,
    'aria-label': label,
    placeholder,
    maxLength,
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
      className={cn(
        boxClassName,
        isEditing ? 'ring-2 ring-ring' : REST_BOX_CLASSNAME,
      )}
      onKeyDown={(event) => {
        // Safari reports the Enter that ends a composition with keyCode 229 instead.
        if (
          !isEditing ||
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
        if (!isEditing || event.currentTarget.contains(event.relatedTarget)) {
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
        {!isEditing ? (
          text
        ) : wrap ? (
          <Textarea
            rows={1}
            enterKeyHint="done"
            className={TEXTAREA_CLASSNAME}
            {...fieldProps}
          />
        ) : (
          <Input
            enterKeyHint="done"
            className={INPUT_CLASSNAME}
            {...fieldProps}
          />
        )}
      </Tag>
      {/* One line tall, so the button centres on the first line of wrapped text. */}
      <span className="flex h-lh shrink-0 items-center">
        <Button
          ref={buttonRef}
          variant="bare"
          aria-label={isEditing ? doneLabel : `${editHint} ${shownText}`}
          className={cn(BUTTON_CLASSNAME, !isEditing && REST_BUTTON_CLASSNAME)}
          // Keeps focus in the field on press, so the click commits once.
          onMouseDown={
            isEditing ? (event) => event.preventDefault() : undefined
          }
          onClick={isEditing ? commitAndFocus : open}
        >
          <Icon aria-hidden className={cn('size-4', iconClassName)} />
        </Button>
      </span>
    </div>
  );
}

// At rest the button's pseudo covers the box, so the box paints the hover and focus.
const REST_BOX_CLASSNAME =
  'transition-colors has-hover:bg-accent has-focus-visible:bg-accent has-focus-visible:ring-3 has-focus-visible:ring-ring/50 motion-reduce:transition-none';
const BUTTON_CLASSNAME =
  '-m-1 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground motion-reduce:transition-none';
const REST_BUTTON_CLASSNAME =
  'static focus-visible:ring-0 after:absolute after:inset-0';
// No chrome, and the box's type: the field looks like the text it replaces.
const FIELD_CLASSNAME =
  'h-auto max-w-full rounded-none border-0 bg-transparent p-0 text-current shadow-none [font:inherit] [letter-spacing:inherit] focus-visible:border-0 focus-visible:ring-0';
const INPUT_CLASSNAME = `${FIELD_CLASSNAME} field-sizing-content w-auto min-w-24`;
const TEXTAREA_CLASSNAME = `${FIELD_CLASSNAME} min-h-0 w-full resize-none overflow-hidden`;

function DisplayText({
  text,
  muted,
  wrap,
}: {
  text: string;
  muted: boolean;
  wrap: boolean;
}) {
  // The text takes its direction on the element, with alignment pinned to the
  // page: truncation needs that, and the same pair serves wrapped text.
  return (
    <span
      dir="auto"
      className={cn(
        'block min-w-0 ltr:text-left rtl:text-right',
        wrap ? 'wrap-break-word whitespace-normal' : 'truncate',
        muted && 'text-muted-foreground',
      )}
    >
      {text}
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
    if (enabled && !supportsFieldSizing()) {
      fitToContent(fieldRef.current);
    }
  }, [fieldRef, value, enabled]);

  React.useEffect(() => {
    const field = fieldRef.current;
    if (!enabled || supportsFieldSizing() || !field) {
      return;
    }
    const observer = new ResizeObserver(() => fitToContent(field));
    observer.observe(field);
    return () => {
      observer.disconnect();
    };
  }, [fieldRef, enabled]);
}

function fitToContent(field: FieldElement | null) {
  if (!(field instanceof HTMLTextAreaElement)) {
    return;
  }
  field.style.height = 'auto';
  field.style.height = `${field.scrollHeight}px`;
}

let fieldSizingSupport: boolean | undefined;

function supportsFieldSizing() {
  fieldSizingSupport ??= CSS.supports('field-sizing', 'content');
  return fieldSizingSupport;
}

export { EditableText };
export type { EditableTextProps };
