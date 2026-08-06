import {
  Field,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from '@op/sense/Field';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

interface OptionBoxProps {
  /** Id of the checkbox / radio rendered as `control`. */
  htmlFor: string;
  /** A sense `Checkbox` or `RadioGroupItem`, already wired to state. */
  control: ReactNode;
  label: ReactNode;
  /** Optional helper text under the label, inside the box. */
  description?: ReactNode;
  /**
   * `hug` shrinks to the label (the horizontal category chips); `fill` stretches
   * to the container (the stacked radio option rows).
   */
  width?: 'hug' | 'fill';
  className?: string;
}

/**
 * A bordered, tinted-when-selected option box wrapping a single checkbox or
 * radio (Figma's checkbox chips and radio rows).
 *
 * The styling lives in `@op/sense` as `FieldLabel variant="box"`; this only
 * wires the control to its label. The control sits inside a real `<label>`, so
 * the whole box is clickable and the input keeps its native behaviour.
 */
export function OptionBox({
  htmlFor,
  control,
  label,
  description,
  width = 'fill',
  className,
}: OptionBoxProps) {
  return (
    <FieldLabel
      variant="box"
      htmlFor={htmlFor}
      className={cn(width === 'hug' && 'w-fit', className)}
    >
      {/* Deliberately no `FieldContent` around the description. The horizontal
          Field adds `mt-1` to a checkbox/radio when it sees one
          (`has-[>[data-slot=field-content]]`), nudging the control down to meet a
          label at its default line-height — but a box title has its half-leading
          trimmed away, so that offset misaligns it. Own the alignment instead:
          `items-start` puts
          the control on the first line, where a 16px control meets a 16px text
          box exactly. */}
      <Field
        orientation="horizontal"
        className={cn(description && 'items-start')}
      >
        {control}
        {description ? (
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <FieldTitle>{label}</FieldTitle>
            <FieldDescription>{description}</FieldDescription>
          </div>
        ) : (
          <FieldTitle>{label}</FieldTitle>
        )}
      </Field>
    </FieldLabel>
  );
}
