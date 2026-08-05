import { FieldDescription, FieldLegend, FieldSet } from '@op/sense/Field';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

interface LabeledFieldSetProps {
  legend: ReactNode;
  /**
   * Id put on the `<legend>`. Pass it when the group's control needs
   * `aria-labelledby` (a `<fieldset>` legend does not name a nested
   * `role="radiogroup"` / `role="group"` element).
   */
  legendId?: string;
  description?: ReactNode;
  required?: boolean;
  className?: string;
  'data-testid'?: string;
  children: ReactNode;
}

/**
 * A `<fieldset>` + `<legend>` group with the proposal form's field-chrome
 * treatment: 16px legend, 14px helper line directly beneath it, 12px to the
 * controls (Figma "Field / Legend").
 *
 * Used for every proposal field whose control is a group rather than a single
 * labelable input — the checkbox-chip category row, the radio option boxes, the
 * location card, attachments.
 */
export function LabeledFieldSet({
  legend,
  legendId,
  description,
  required,
  className,
  'data-testid': testId,
  children,
}: LabeledFieldSetProps) {
  return (
    <FieldSet className={cn('gap-3', className)} data-testid={testId}>
      <FieldLegend variant="label" id={legendId}>
        {legend}
        {required && <RequiredAsterisk />}
      </FieldLegend>
      {description && (
        // Cancel the FieldSet gap so the helper line sits flush under the
        // legend, as one block. The `nth-last-2` copy overrides
        // FieldDescription's own same-variant rule, which would otherwise win
        // on specificity when the description is the second-to-last child.
        <FieldDescription>{description}</FieldDescription>
      )}
      {children}
    </FieldSet>
  );
}
