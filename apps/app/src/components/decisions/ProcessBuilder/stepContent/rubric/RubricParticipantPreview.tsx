'use client';

import type { RubricTemplateSchema } from '@op/common/client';
import { Header2 } from '@op/sense/Header';
import { useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { compileRubricSchema } from '../../../forms/rubric';
import { RubricFormPreviewRenderer } from './RubricFormPreviewRenderer';

/**
 * Live reviewer preview of the rubric.
 *
 * Compiles the rubric template into field descriptors and renders them via
 * `RubricFormPreviewRenderer` in a static, non-interactive preview.
 * Container-agnostic: the caller supplies the surface (modal, panel, etc.).
 */
export function RubricParticipantPreview({
  template,
}: {
  template: RubricTemplateSchema;
}) {
  const t = useTranslations();

  const fields = useMemo(() => compileRubricSchema(template), [template]);

  return (
    <div className="rounded-lg bg-white p-6">
      <Header2 className="mb-6 font-serif text-neutral-charcoal">
        {t('Review Proposal')}
      </Header2>

      <RubricFormPreviewRenderer fields={fields} />
    </div>
  );
}
