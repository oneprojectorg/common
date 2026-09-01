import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';

interface ReviewResultCardProps {
  children: ReactNode;
  className?: string;
}

interface ReviewResultOptionProps {
  /** The option the reviewer picked — its title, or the raw value. */
  title: string;
  /** The option's own explanation, as the rubric author wrote it. */
  description?: string;
  className?: string;
}

interface ReviewResultTextProps {
  children: string;
  className?: string;
}

interface ReviewResultNoteProps {
  children: string;
  className?: string;
}

/**
 * A submitted answer to one review criterion. Bordered, not filled — a filled
 * row reads as a total in this panel. The shell only stacks what it is given,
 * so an empty card is a caller bug, not an empty state.
 */
function ReviewResultCard({ children, className }: ReviewResultCardProps) {
  return (
    <div className={cn('flex flex-col gap-3 rounded-lg border p-6', className)}>
      {children}
    </div>
  );
}

/**
 * One picked option: the answer in serif, its explanation as body copy below.
 * Both halves are template-authored, so they take the document's direction — a
 * `dir="auto"` here would land title and explanation on opposite sides.
 */
function ReviewResultOption({
  title,
  description,
  className,
}: ReviewResultOptionProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="font-serif text-label">{title}</span>
      {description ? (
        // Authored copy, so its line breaks are meant.
        <p className="text-base whitespace-pre-wrap text-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A written answer, where the criterion asked for prose rather than an option.
 * `dir="auto"`: the reviewer may not write in the interface language.
 */
function ReviewResultText({ children, className }: ReviewResultTextProps) {
  return (
    <p
      dir="auto"
      className={cn('text-base whitespace-pre-wrap text-foreground', className)}
    >
      {children}
    </p>
  );
}

/**
 * The reviewer's note on their own answer, muted under a rule it draws itself
 * on `:not(:first-child)` — so a note that is the card's only content shows no
 * line, with no separator for the caller to place or to forget to omit.
 *
 * Nothing enforces that at runtime: the note must be a DIRECT child of
 * `ReviewResultCard`, after the answer content. Wrapped, it is its own
 * parent's first child and never draws; placed first, it draws above content.
 */
function ReviewResultNote({ children, className }: ReviewResultNoteProps) {
  return (
    <p
      dir="auto"
      className={cn(
        'text-base text-muted-foreground [&:not(:first-child)]:border-t [&:not(:first-child)]:pt-3',
        className,
      )}
    >
      {children}
    </p>
  );
}

export {
  ReviewResultCard,
  ReviewResultOption,
  ReviewResultText,
  ReviewResultNote,
  type ReviewResultCardProps,
  type ReviewResultOptionProps,
  type ReviewResultTextProps,
  type ReviewResultNoteProps,
};
