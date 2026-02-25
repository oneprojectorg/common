'use client';

import { trpc } from '@op/api/client';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';
import { CodeAnimation } from './RubricComingSoonAnimation';
import { RubricParticipantPreview } from './RubricParticipantPreview';

function CriteriaSectionContent({ instanceId }: SectionProps) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });
  const rubricTemplate = instance.instanceData?.rubricTemplate;

  return (
    <div className="flex h-full flex-row">
      <div className="mx-auto flex flex-1 flex-col items-center justify-center gap-4 p-4 py-16 md:p-8">
        <CodeAnimation />
        <span className="text-neutral-gray4">
          {t('We are currently working on this, stay tuned!')}
        </span>
      </div>

      {rubricTemplate && <RubricParticipantPreview template={rubricTemplate} />}
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
