'use client';

import { Input } from '@op/sense/Input';
import { Textarea } from '@op/sense/Textarea';
import { cn } from '@op/sense/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { LuPencil } from 'react-icons/lu';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * A heading you can rewrite, with the pencil showing until you take it up.
 *
 * The dashed underline this replaces was a hint you had to already understand:
 * it said "this is a field" in a language nothing else on the page speaks. A
 * pencil says "edit", at rest, without being hovered for — and the tint under it
 * on approach is the one the design system already uses for a surface being
 * interacted with (`focus:bg-accent` on menu and select items), so the whole
 * title reads as one control rather than as text with something odd under it.
 *
 * `accent` rather than `muted`, which is the usual hover: this page's own shell
 * is `bg-muted`, so a muted tint here is exactly the colour it sits on and there
 * is nothing to see.
 *
 * Editing drops both the pencil and that tint: the offer has been taken, so
 * neither the icon nor the highlight has anything left to say, and the title is
 * left sitting on the same ground it reads on.
 *
 * Committing is deliberately quiet: the value goes to the page's own form state
 * and the page's `Update` lights up. No per-field save, and no toast for typing
 * a word.
 */
export function PrototypeTitleField({
  value,
  onChange,
  ariaLabel,
  className,
  multiline = false,
  centered = false,
  onImage = false,
}: {
  value: string;
  /** Local form state only — the page owns saving. */
  onChange: (next: string) => void;
  ariaLabel: string;
  /**
   * The heading's own type, worn by both states so neither shifts. Type only —
   * the colour belongs to this component, which has to change it between the
   * two states when the title is sitting on a picture.
   */
  className?: string;
  /** A long title wraps rather than scrolling its one line. */
  multiline?: boolean;
  /** Centred in its column, like the overview's hero. */
  centered?: boolean;
  /**
   * The title sits on a banner image, where it is white. A pale tint under white
   * text is unreadable, so approach is darkened instead of lightened. Editing
   * keeps the white text, since it keeps the picture under it too.
   */
  onImage?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const field = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  /* Whether leaving edit mode should hand focus back to the title. Set by the
     keyboard paths only — a blur has already put focus where it was going. */
  const returnFocus = useRef(false);

  /* Everything the box is, in one place: the read button and the editing row
     wear it identically, which is what keeps the title from moving as it swaps.
     Pulled back out with `-mx-2` so the padding does not indent the heading
     from everything else in the column. */
  const box = cn(
    '-mx-2 inline-flex max-w-full items-center gap-2 rounded-lg px-2 py-1 transition-colors motion-reduce:transition-none',
    centered && 'justify-center text-center',
  );

  useEffect(() => {
    if (isEditing) {
      /* Selected, not just focused: the common edit is a rewrite, and a caret
         parked at one end makes you clear the old text yourself. */
      field.current?.select();

      return;
    }

    /* After the swap, not during it: focusing the title from inside the key
       handler did nothing, because the button it points at had not been
       rendered yet. */
    if (returnFocus.current) {
      returnFocus.current = false;
      trigger.current?.focus();
    }
  }, [isEditing]);

  const open = () => {
    setDraft(value);
    setIsEditing(true);
  };

  /* A title is the one thing on the page that cannot be blank, so an empty
     value is treated as "never mind" rather than written through. */
  const close = (next: string | null) => {
    const trimmed = next?.trim();

    if (trimmed) {
      onChange(trimmed);
    }

    setIsEditing(false);
  };

  if (isEditing) {
    /* De-chromed to the heading it stands in for, and `field-sizing-content` so
       it is exactly as wide as its text — a full-width field would stretch the
       white box across the column the moment you clicked. */
    const fieldProps = {
      ref: field,
      value: draft,
      'aria-label': ariaLabel,
      className: cn(
        'field-sizing-content h-auto min-w-0 rounded-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0',
        centered && 'text-center',
        // Same colour as at rest, because the ground has not changed either.
        onImage && 'text-white caret-white',
        className,
      ),
      onChange: (event: { target: { value: string } }) =>
        setDraft(event.target.value),
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          returnFocus.current = true;
          close(draft);
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          // Reverts: the draft is dropped and nothing is written.
          returnFocus.current = true;
          close(null);
        }
      },
      /* Blur commits but does not chase the focus back to the title — you
         clicked something else, and that is where you meant to be. */
      onBlur: () => close(draft),
    };

    return (
      /* No fill at all while editing: the tint is what offers the edit, and once
         the offer is taken there is nothing left to offer. The title stays on the
         ground it was always on, which is also the only treatment that works over
         a banner — a box of its own there would either hide the picture or hide
         the text. */
      <div className={box}>
        {multiline ? (
          <Textarea
            {...fieldProps}
            rows={1}
            className={cn(
              fieldProps.className,
              // Grows with its lines instead of scrolling them.
              'min-h-0 resize-none overflow-hidden',
            )}
          />
        ) : (
          <Input {...fieldProps} />
        )}
        {/* Gone, but its space is not: a centred title recentres itself the
            moment the icon leaves the row, so the text would jump sideways as
            you clicked it. `invisible` keeps the gap without showing anything.
            A start-aligned title is anchored at its left edge and needs none of
            this. */}
        {centered ? (
          <LuPencil className="invisible size-5 shrink-0" aria-hidden />
        ) : null}
      </div>
    );
  }

  return (
    <button
      ref={trigger}
      type="button"
      /* The title and the pencil are one target: the pencil is what tells you
         the title is editable, so it would be strange for it not to be the thing
         you can press. */
      onClick={open}
      className={cn(
        box,
        'group cursor-pointer focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        centered ? 'text-center' : 'text-start',
        // Darkened on a picture, tinted on a page. See `onImage`.
        onImage ? 'hover:bg-overlay/20' : 'hover:bg-accent',
      )}
    >
      <span
        className={cn(
          'min-w-0',
          // Wrapping titles are the reason `multiline` exists; the rest truncate.
          multiline ? 'whitespace-pre-wrap' : 'truncate',
          onImage && 'text-white',
          className,
        )}
      >
        {value}
      </span>
      <LuPencil
        className={cn(
          'size-5 shrink-0 transition-colors motion-reduce:transition-none',
          onImage
            ? 'text-white/80 group-hover:text-white'
            : 'text-muted-foreground group-hover:text-foreground',
        )}
        aria-hidden
      />
    </button>
  );
}
