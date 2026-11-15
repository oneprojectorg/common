import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/**
 * What the develop screen shows when it has no origins to list: none in the
 * previous phase, or, for a caller who sees only their own, none assigned.
 */
export function NoOriginsEmpty({
  isAssignedOnly = false,
}: {
  /** The list holds only the origins assigned to the caller. */
  isAssignedOnly?: boolean;
}) {
  const t = useTranslations('decisions.develop');

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-6" />
        </EmptyMedia>
        <EmptyTitle render={<h3 />}>
          {isAssignedOnly ? t('noAssignedOriginsTitle') : t('noOriginsTitle')}
        </EmptyTitle>
        <EmptyDescription>
          {isAssignedOnly
            ? t('noAssignedOriginsDescription')
            : t('noOriginsDescription')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
