import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';
import { CodeAnimation } from './RubricComingSoonAnimation';

export default function CriteriaSection(_props: SectionProps) {
  const t = useTranslations();

  return (
    <div className="mx-auto flex h-full w-full max-w-160 flex-col items-center justify-center gap-4 p-4 py-16 md:p-8">
      <CodeAnimation />
      <span className="text-neutral-gray4">
        {t('We are currently working on this, stay tuned!')}
      </span>
    </div>
  );
}
