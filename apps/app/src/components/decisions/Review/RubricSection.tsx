'use client';

import type { TemplateSection } from '@op/common/client';
import type { ReactNode } from 'react';

import { FieldHeader } from '../forms/FieldHeader';

/**
 * A presentational criterion group: the section title in the serif heading
 * style (the same treatment as a criterion title such as "Overall
 * Recommendation"), its optional description, then its members rendered
 * exactly as they would be ungrouped.
 */
export function RubricSectionShell({
  section,
  children,
}: {
  section: TemplateSection;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <FieldHeader title={section.title} description={section.description} />
      {children}
    </section>
  );
}
