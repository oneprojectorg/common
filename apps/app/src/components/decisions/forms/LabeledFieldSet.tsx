import { FieldDescription, FieldLegend, FieldSet } from '@op/sense/Field';
import { RequiredAsterisk } from '@op/sense/RequiredAsterisk';
import { cn } from '@op/sense/lib/utils';
import type { ReactNode } from 'react';

interface LabeledFieldSetProps {
  legend: ReactNode;
  /**
   * Id for the `<legend>` — a legend doesn't name a nested `role="radiogroup"`,
   * so those controls need `aria-labelledby`.
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
 * For every proposal field whose control is a group rather than one input.
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
        // Cancel the FieldSet gap so the helper sits flush under the legend.
        // The `nth-last-2` copy beats FieldDescription's own rule on specificity.
        <FieldDescription>{description}</FieldDescription>
      )}
      {children}
    </FieldSet>
  );
}
