import { Header3 } from '@op/sense/Header';

import { useTranslations } from '@/lib/i18n';

// "328 proposals", or "6 of 328 proposals" once `total` says something was
// filtered out.
export const ProposalCount = ({
  count,
  total,
}: {
  count: number;
  total?: number;
}) => {
  const t = useTranslations('decisions.proposals');
  const narrowed = total != null && count < total;

  if (!narrowed) {
    return (
      <Header3>
        {t('proposalCount', {
          count: total ?? count,
        })}
      </Header3>
    );
  }

  return (
    <span className="flex items-baseline gap-1">
      <Header3>{count}</Header3>
      <span className="text-base text-muted-foreground">
        {t('ofTotalProposals', {
          total,
        })}
      </span>
    </span>
  );
};
