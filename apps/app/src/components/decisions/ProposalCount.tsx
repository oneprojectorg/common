import { Header3 } from '@op/sense/Header';

import { useTranslations } from '@/lib/i18n';

// Canonical proposal count label. With no `total` (or nothing filtered out) it
// reads a single-size "328 proposals"; a narrowing search sets `total` to the
// full pool and it reads "6 of 328 proposals" with a muted remainder.
//
// `Header3` rather than a hand-rolled `font-serif text-title`: this labels its
// list exactly as "Selected proposals" and "My ballot" label theirs on the
// sibling tabs, so it is the same component and not a copy of its classes that
// can drift from them.
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
      {/* Deliberately not part of the heading: the remainder is a quiet aside
          about what was filtered out, not part of what this list is called. */}
      <span className="text-base text-muted-foreground">
        {t('ofTotalProposals', {
          total,
        })}
      </span>
    </span>
  );
};
