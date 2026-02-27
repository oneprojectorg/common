'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';
import { CodeAnimation } from './RubricComingSoonAnimation';
import { RubricEditorContent } from './RubricEditorContent';

export default function CriteriaSection(props: SectionProps) {
  return (
    <Suspense>
      <CriteriaSectionContent {...props} />
    </Suspense>
  );
}

function CriteriaSectionContent(props: SectionProps) {
  const t = useTranslations();
  const rubricBuilderEnabled = useFeatureFlag('rubric_builder');

  if (rubricBuilderEnabled) {
    return <RubricEditorContent {...props} />;
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-160 flex-col items-center justify-center gap-4 p-4 py-16 md:p-8">
      <CodeAnimation />
      <span className="text-neutral-gray4">
        {t('We are currently working on this, stay tuned!')}
      </span>
    </div>
  );
}
