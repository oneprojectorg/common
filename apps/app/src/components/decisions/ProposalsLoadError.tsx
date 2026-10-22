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
 * What every proposals surface shows when its list fails to load — the review
 * screen, the admin progress list, and the selection screen all pass it as
 * their `APIErrorBoundary` default fallback.
 */
export const ProposalsLoadError = () => {
  const t = useTranslations('decisions.proposals');

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <LuLeaf className="size-6" />
        </EmptyMedia>
        <EmptyTitle>{t('proposalsLoadError')}</EmptyTitle>
        <EmptyDescription>{t('refreshPageHint')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};
