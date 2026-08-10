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
      {/* `dir="auto"`: legends and helper lines here are proposal-template text
          someone authored, so the direction follows the content rather than the
          reader's locale. Harmless for the translated fallbacks a few fields
          pass instead — those resolve to the locale direction anyway. */}
      <FieldLegend variant="label" id={legendId} dir="auto">
        {legend}
        {required && <RequiredAsterisk />}
      </FieldLegend>
      {description && (
        // Sits flush under the legend via FieldDescription's own
        // `[[data-variant=legend]+&]:-mt-1.5`, which cancels the FieldSet gap.
        <FieldDescription dir="auto">{description}</FieldDescription>
      )}
      {children}
    </FieldSet>
  );
}
