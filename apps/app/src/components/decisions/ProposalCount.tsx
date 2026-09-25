import { Header3 } from '@op/sense/Header';

import { useTranslations } from '@/lib/i18n';

// "328 proposals", or "6 of 328 proposals" with a muted remainder once `total`
// says something was filtered out. `Header3` because this labels its list the
// same way the sibling tabs label theirs.
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
      {/* Outside the heading: an aside about what was filtered out, not part of
          what the list is called. */}
      <span className="text-base text-muted-foreground">
        {t('ofTotalProposals', {
          total,
        })}
      </span>
    </span>
  );
};
