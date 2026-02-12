import { EmptyState } from '@op/ui/EmptyState';
import { LuClipboardCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import type { SectionProps } from '../../contentRegistry';

export default function CriteriaSection(_props: SectionProps) {
  const t = useTranslations();

  return (
    <div className="mx-auto w-full max-w-160 p-4 md:p-8">
      <div className="py-16">
        <EmptyState icon={<LuClipboardCheck className="size-5" />}>
          <span className="text-neutral-gray4">
            {t("We're almost there with this!")}
          </span>
        </EmptyState>
      </div>
    </div>
  );
}
