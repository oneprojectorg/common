'use client';

import type { RubricTemplateSchema } from '@op/common/client';
import { Header2 } from '@op/ui/Header';
import { useMemo } from 'react';
import { LuEye } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { compileRubricSchema } from '../../../forms/rubric';
import { RubricFormPreviewRenderer } from './RubricFormPreviewRenderer';

/**
 * Live participant preview panel for rubric criteria.
 *
 * Mirrors the proposal `ParticipantPreview` pattern: compiles the rubric
 * template into field descriptors and renders them via `RubricFormPreviewRenderer`
 * in a static, non-interactive preview aside panel.
 */
export function RubricParticipantPreview({
  template,
}: {
  template: RubricTemplateSchema;
}) {
  const t = useTranslations();

  const fields = useMemo(() => compileRubricSchema(template), [template]);

  if (fields.length === 0) {
    return null;
  }

  return (
    <aside className="xxl:p-14 hidden flex-1 basis-1/2 overflow-y-auto border-l bg-neutral-offWhite p-8 lg:block xl:p-12">
      <div className="rounded-lg bg-white p-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-neutral-gray3">
          <LuEye className="size-4" />
          <span>{t('Participant Preview')}</span>
        </div>

        <Header2 className="mb-6 font-serif text-neutral-charcoal">
          {t('Review Proposal')}
        </Header2>

        <RubricFormPreviewRenderer fields={fields} />
      </div>
    </aside>
  );
}
