import {
  Field,
  FieldContent,
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
 * All of the box styling lives in `@op/sense` as `FieldLabel variant="box"`
 * (Figma `RadioButton`/`Checkbox` → `Type=Box`) — this component only wires the
 * control to its label. Because the control sits inside a real `<label>`, the
 * whole box is clickable while the checkbox/radio keeps its native semantics,
 * keyboard behaviour and focus ring.
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
      <Field orientation="horizontal">
        {control}
        {description ? (
          // FieldContent stacks title over description and keeps the control
          // top-aligned against a multi-line box.
          <FieldContent>
            <FieldTitle>{label}</FieldTitle>
            <FieldDescription>{description}</FieldDescription>
          </FieldContent>
        ) : (
          <FieldTitle>{label}</FieldTitle>
        )}
      </Field>
    </FieldLabel>
  );
}
