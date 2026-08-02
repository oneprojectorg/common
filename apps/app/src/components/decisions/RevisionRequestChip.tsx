import { Badge } from '@op/sense/Badge';
import { cn } from '@op/sense/lib/utils';
import { LuCircleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

export function RevisionRequestChip({ className }: { className?: string }) {
  const t = useTranslations();
  return (
    <Badge
      variant="secondary"
      className={cn('inline-flex gap-1 bg-primary-orange2/10', className)}
    >
      <LuCircleAlert className="size-3 text-primary-orange2" />
      {t('Revision requested')}
    </Badge>
  );
}
