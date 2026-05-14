import { Chip } from '@op/ui-next/Chip';
import { cn } from '@op/ui/utils';
import { LuCircleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export function RevisionRequestChip({ className }: { className?: string }) {
  const t = useTranslations();
  return (
    <Chip className={cn('inline-flex gap-1 bg-primary-orange2/10', className)}>
      <LuCircleAlert className="size-3 text-primary-orange2" />
      {t('Revision requested')}
    </Chip>
  );
}
