'use client';

import { Badge } from '@op/sense/Badge';

import { useTranslations } from '@/lib/i18n';

const DEFAULT_MAX_CATEGORIES = 2;

export function SelectionCategoryChips({
  labels,
  max = DEFAULT_MAX_CATEGORIES,
}: {
  labels: string[];
  max?: number;
}) {
  const t = useTranslations();
  const visible = labels.slice(0, max);
  const extra = labels.length - visible.length;

  if (labels.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((label) => (
        <Badge key={label} variant="secondary" className="line-clamp-1">
          {label}
        </Badge>
      ))}
      {extra > 0 && (
        <span className="text-xs text-muted-foreground">
          {t('+{count} More', { count: extra })}
        </span>
      )}
    </div>
  );
}
