import { useTranslations } from '@/lib/i18n';

// Canonical proposal count label. With no `total` (or nothing filtered out) it
// reads a single-size "328 proposals"; a narrowing search sets `total` to the
// full pool and it reads "6 of 328 proposals" with a muted remainder.
export const ProposalCount = ({
  count,
  total,
}: {
  count: number;
  total?: number;
}) => {
  const t = useTranslations();
  const narrowed = total != null && count < total;

  if (!narrowed) {
    return (
      <span className="font-serif text-title font-light">
        {t('{count, plural, one {# proposal} other {# proposals}}', {
          count: total ?? count,
        })}
      </span>
    );
  }

  return (
    <span className="flex items-baseline gap-1">
      <span className="font-serif text-title font-light">{count}</span>
      <span className="text-base text-muted-foreground">
        {t('of {total, plural, one {# proposal} other {# proposals}}', {
          total,
        })}
      </span>
    </span>
  );
};
