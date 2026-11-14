import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@op/sense/Empty';
import { LuLeaf } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/** What the develop screen shows when the previous phase offers no origins. */
export function NoOriginsEmpty() {
  const t = useTranslations('decisions.develop');

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-6" />
        </EmptyMedia>
        <EmptyTitle render={<h3 />}>{t('noOriginsTitle')}</EmptyTitle>
        <EmptyDescription>{t('noOriginsDescription')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
