import type { ReactNode } from 'react';

import { cn } from '../../lib/utils';
import { Field, FieldDescription, FieldLabel, FieldTitle } from '../ui/field';

interface OptionBoxProps {
  /** Id of the checkbox / radio rendered as `control`. */
  htmlFor: string;
  /** A `Checkbox` or `RadioGroupItem`, already wired to state. */
  control: ReactNode;
  label: ReactNode;
  /** Optional helper text under the label, inside the box. */
  description?: ReactNode;
  /**
   * `hug` shrinks to the label (the horizontal category chips); `fill` stretches
   * to the container (the stacked radio option rows).
   */
  width?: 'hug' | 'fill';
  /**
   * Which side the control sits on (Figma's `Control Placement`). `end` pushes
   * it to the trailing edge and lets the label fill the space — logical, so it
   * flips with the writing direction.
   */
  controlPlacement?: 'start' | 'end';
  /**
   * Content on the side opposite the control — an avatar, icon or thumbnail.
   * It follows `controlPlacement` rather than taking a side of its own, so the
   * two can never collide.
   */
  accessory?: ReactNode;
  /**
   * Direction for the whole box, resolved from the label's first strong
   * character by default: an option written in another script reads as one
   * coherent block, control and description on the same side, rather than each
   * part resolving on its own and disagreeing. Pin it to `ltr`/`rtl` when the
   * label is UI chrome rather than content.
   */
  dir?: 'ltr' | 'rtl' | 'auto';
  className?: string;
}

/**
 * A bordered, tinted-when-selected option box wrapping a single checkbox or
 * radio (Figma's checkbox chips and radio rows).
 *
 * The styling is `FieldLabel variant="box"`; this only wires the control to its
 * label. The control sits inside a real `<label>`, so the whole box is clickable
 * and the input keeps its native behaviour.
 */
function OptionBox({
  htmlFor,
  control,
  label,
  description,
  width = 'fill',
  controlPlacement = 'start',
  accessory,
  dir = 'auto',
  className,
}: OptionBoxProps) {
  // A description already needs the block; so does anything that has to sit at
  // an edge, since the label is what takes up the slack between them.
  const content =
    description || controlPlacement === 'end' || accessory ? (
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <FieldTitle>{label}</FieldTitle>
        {description ? (
          <FieldDescription>{description}</FieldDescription>
        ) : null}
      </div>
    ) : (
      <FieldTitle>{label}</FieldTitle>
    );

  return (
    <FieldLabel
      variant="box"
      htmlFor={htmlFor}
      dir={dir}
      className={cn(width === 'hug' && 'w-fit', className)}
    >
      {/* Deliberately no `FieldContent` around the description. The horizontal
          Field adds `mt-1` to a checkbox/radio when it sees one
          (`has-[>[data-slot=field-content]]`), nudging the control down to meet a
          label at its default line-height — but a box title has its half-leading
          trimmed away, so that offset misaligns it. Own the alignment instead:
          `items-start` puts the control on the first line, where a 16px control
          meets a 16px text box exactly. */}
      <Field
        orientation="horizontal"
        className={cn(description && 'items-start')}
      >
        {controlPlacement === 'end' ? (
          <>
            {accessory}
            {content}
            {control}
          </>
        ) : (
          <>
            {control}
            {content}
            {accessory}
          </>
        )}
      </Field>
    </FieldLabel>
  );
}

export { OptionBox, type OptionBoxProps };
