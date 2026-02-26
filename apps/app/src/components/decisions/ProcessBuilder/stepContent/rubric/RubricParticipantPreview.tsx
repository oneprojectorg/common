'use client';

import type { RubricTemplateSchema } from '@op/common/client';
import { useMemo } from 'react';
import { LuEye } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { compileRubricSchema } from '../../../forms/compileRubricSchema';
import { RubricFormRenderer } from './RubricFormRenderer';

/**
 * Live participant preview panel for rubric criteria.
 *
 * Mirrors the proposal `ParticipantPreview` pattern: compiles the rubric
 * template into field descriptors and renders them via `RubricFormRenderer`
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
    <aside className="hidden flex-1 basis-1/2 overflow-y-auto border-l bg-neutral-offWhite p-14 xl:block">
      <div className="rounded-lg bg-white p-6">
        <div className="mb-6 flex items-center gap-2 text-sm text-neutral-500">
          <LuEye className="size-4" />
          <span>{t('Participant Preview')}</span>
        </div>

        <h2 className="mb-6 font-serif text-title-lg text-neutral-charcoal">
          {t('Review Proposal')}
        </h2>

        <RubricFormRenderer fields={fields} />
      </div>
    </aside>
  );
}
