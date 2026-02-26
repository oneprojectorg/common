'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';
import { CodeAnimation } from './RubricComingSoonAnimation';
import { RubricParticipantPreview } from './RubricParticipantPreview';
import { DUMMY_RUBRIC_TEMPLATE } from './dummyRubricTemplate';

function CriteriaSectionContent(_props: SectionProps) {
  const t = useTranslations();
  const rubricBuilderEnabled = useFeatureFlag('rubric_builder');

  if (rubricBuilderEnabled) {
    return (
      <div className="flex h-full flex-col md:flex-row">
        {/* Left panel — placeholder for the future rubric builder */}
        <main className="flex-1 basis-1/2 overflow-y-auto p-4 pb-24 md:p-8 md:pb-8" />

        <RubricParticipantPreview template={DUMMY_RUBRIC_TEMPLATE} />
      </div>
    );
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

export default function CriteriaSection(props: SectionProps) {
  return (
    <Suspense>
      <CriteriaSectionContent {...props} />
    </Suspense>
  );
}
