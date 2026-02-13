import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';
import { CodeAnimation } from './RubricComingSoonAnimation';

export default function CriteriaSection(_props: SectionProps) {
  const t = useTranslations();

  return (
    <div className="mx-auto w-full max-w-160 p-4 md:p-8">
      <div className="py-16">
        <CodeAnimation />
        <span className="text-neutral-gray4">
          {t("We're almost there with this!")}
        </span>
      </div>
    </div>
  );
}
